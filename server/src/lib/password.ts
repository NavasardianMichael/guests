import { Algorithm, hash, verify } from '@node-rs/argon2'
import { randomBytes } from 'node:crypto'

/**
 * Password hashing and policy.
 *
 * **This module imports nothing of its own — deliberately.** No `../config.js`, no
 * `./prisma.js`. Per `tests/CLAUDE.md` that is what keeps it reachable from
 * `tests/unit/server/`, and it means the parameters below cannot be weakened by editing an
 * env file. `parsePasswordHash`, `needsRehash` and `validatePassword` are pure and cost
 * nothing to test; `hashPassword`/`verifyPassword` cost ~80ms, which a spec can afford.
 *
 * `@node-rs/argon2` rather than `argon2`: it ships prebuilt N-API binaries as platform
 * optional dependencies, so there is no node-gyp step. `argon2`'s node-pre-gyp fallback
 * compiles from source when a prebuild is missing, which on Windows means Visual Studio
 * build tools — in the `pnpm install` postinstall path.
 */

/**
 * Argon2**id** — the hybrid. Argon2i alone is weak against time-memory tradeoffs; Argon2d
 * alone leaks through data-dependent memory access, which matters on shared hardware. `id`
 * is what OWASP, RFC 9106 and libsodium all default to.
 *
 * 64 MiB / 3 passes / 4 lanes is OWASP's stronger cited configuration (their floor is
 * m=19456, t=2, p=1). Memory is the expensive axis for an attacker with GPUs: doubling
 * `memoryCost` roughly doubles their silicon, while doubling `timeCost` only doubles their
 * clock.
 *
 * `parallelism` is encoded into the hash, so it can never be lowered for an existing row
 * without a rehash — which `needsRehash` is for.
 *
 * Operational note: the async `hash`/`verify` run on the libuv threadpool, which defaults
 * to **4** threads, and each call wants 4 lanes and 64 MiB. Eight concurrent logins hold
 * ~512 MB. That is not a reason to weaken these numbers — it is why the rate limiters on
 * the auth routes are load-bearing rather than decorative — but set `UV_THREADPOOL_SIZE`
 * deliberately at deploy time rather than discovering it under load.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65_536, // KiB = 64 MiB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
} as const

/** The argon2 PHC version we mint. Anything older is rehashed on next successful login. */
const ARGON2_VERSION = 19

export const hashPassword = (plain: string): Promise<string> => hash(plain, ARGON2_OPTIONS)

/**
 * Argument order is `(stored, plain)` and is wrapped here so no call site has to remember
 * it. Getting it backwards is a silent, total failure — the compare simply never succeeds,
 * because argon2 is handed a plaintext where it expects an encoded hash — and it is a live
 * bug in the reference implementation this replaces.
 *
 * Never throws: a malformed or truncated stored hash makes the library throw, and a corrupt
 * row must read as "wrong password" rather than becoming a 500.
 */
export const verifyPassword = async (stored: string, plain: string): Promise<boolean> => {
  try {
    return await verify(stored, plain, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

type PhcParams = {
  algorithm: string
  version: number
  memoryCost: number
  timeCost: number
  parallelism: number
}

/**
 * Parses `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`.
 *
 * Pure string work, no crypto — which is the point: `needsRehash` below is the security
 * decision, and this is the part worth exhaustive unit tests.
 */
export const parsePasswordHash = (stored: string): PhcParams | null => {
  const parts = stored.split('$')
  // ['', algorithm, v=N, m=..,t=..,p=.., salt, hash]
  if (parts.length !== 6 || parts[0] !== '') return null

  const versionField = parts[2]
  const paramField = parts[3]
  if (!versionField?.startsWith('v=') || !paramField) return null

  const params = new Map(
    paramField.split(',').map((pair) => {
      const [key, value] = pair.split('=')
      return [key, Number(value)] as const
    })
  )

  const version = Number(versionField.slice(2))
  const memoryCost = params.get('m')
  const timeCost = params.get('t')
  const parallelism = params.get('p')

  if (
    !Number.isFinite(version) ||
    !Number.isFinite(memoryCost) ||
    !Number.isFinite(timeCost) ||
    !Number.isFinite(parallelism)
  ) {
    return null
  }

  return {
    algorithm: parts[1] ?? '',
    version,
    memoryCost: memoryCost as number,
    timeCost: timeCost as number,
    parallelism: parallelism as number,
  }
}

/**
 * True when the stored hash is weaker than what we mint today, so a successful login can
 * transparently upgrade it.
 *
 * Comparisons are `<`, never `!==`, so a *stronger* stored hash is never downgraded — that
 * would be a silent security regression on a redeploy that lowered a parameter. An
 * unparseable or non-argon2id hash counts as stale, which is also how any bcrypt row left
 * behind by a botched migration gets upgraded rather than trusted.
 */
export const needsRehash = (stored: string): boolean => {
  const parsed = parsePasswordHash(stored)
  if (!parsed) return true
  return (
    parsed.algorithm !== 'argon2id' ||
    parsed.version < ARGON2_VERSION ||
    parsed.memoryCost < ARGON2_OPTIONS.memoryCost ||
    parsed.timeCost < ARGON2_OPTIONS.timeCost ||
    parsed.parallelism < ARGON2_OPTIONS.parallelism
  )
}

/**
 * A real argon2id hash of a value nobody knows, computed once per process and used to burn
 * the same ~80ms when the submitted email has no account — so an unknown address and a
 * wrong password are indistinguishable by timing. Returning early instead is a measurable
 * oracle, and is one of the defects in the implementation this replaces.
 *
 * Computed rather than hardcoded so it always tracks `ARGON2_OPTIONS`: a literal baked into
 * source would keep doing the *old* amount of work after a parameter change, quietly
 * reopening the gap it exists to close.
 */
let dummyHash: Promise<string> | null = null

export const verifyDummyPassword = async (plain: string): Promise<false> => {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'))
  try {
    await verify(await dummyHash, plain, ARGON2_OPTIONS)
  } catch {
    /* Always false; the point is the elapsed time, not the answer. */
  }
  return false
}

/**
 * Deliberately few rules. NIST SP 800-63B §5.1.1.2 advises *against* composition
 * requirements — they push people toward `Password1!` and buy little. Length is what pays.
 * The letter/digit rule is kept only as a floor against `12345678`, and the count is kept
 * small because every rule here has to be mirrored by hand in `src/constants/form.ts`, and
 * a long list will drift.
 *
 * `max` is not a security limit — argon2 has no bcrypt-style 72-byte truncation. It bounds
 * work: hashing an unbounded body field is a DoS lever.
 *
 * **Keep in step with `FORM_ITEM_RULES.password` in `src/constants/form.ts`.**
 */
export const PASSWORD_POLICY = { min: 8, max: 128 } as const

export type PasswordCheck = { ok: true } | { ok: false; message: string }

/**
 * Both regexes are single-character classes with no alternation or nesting, run on a
 * length-capped string, so neither can backtrack — the same reasoning `lib/request.ts`
 * documents for `isEmail`.
 */
export const validatePassword = (plain: unknown, ctx: { email?: string } = {}): PasswordCheck => {
  if (typeof plain !== 'string' || plain.length < PASSWORD_POLICY.min) {
    return { ok: false, message: `Password must be at least ${PASSWORD_POLICY.min} characters` }
  }
  if (plain.length > PASSWORD_POLICY.max) {
    return { ok: false, message: `Password must be at most ${PASSWORD_POLICY.max} characters` }
  }
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    return { ok: false, message: 'Password must contain at least one letter and one number' }
  }

  // A password that contains the account name is the one guess an attacker always makes.
  // Only checked from 3 characters up, so a short local part does not ban half the alphabet.
  const localPart = ctx.email?.split('@')[0]?.toLowerCase()
  if (localPart && localPart.length >= 3 && plain.toLowerCase().includes(localPart)) {
    return { ok: false, message: 'Password must not contain your email address' }
  }

  return { ok: true }
}
