import type { Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../src/lib/password.js'
import { coerceContent, coerceDesign } from '../src/services/listDocument.js'
import { TEMPLATE_PRICE_AMD } from '../src/services/pricing.js'

// The API's own loader, so the seed reads the same env files as the API and `prisma migrate`
// (`.env.development.local` first) — `dotenv/config` reads only `server/.env`.
import '../src/load-env.js'

// Imported only now, after the env files: on import, @prisma/client loads `server/.env` by
// itself, and dotenv never overrides — a static import would let that file win.
const { PrismaClient } = await import('@prisma/client')

/**
 * Local test accounts (docs/DEV_CREDS.md). Runs on every `pnpm install` through
 * scripts/postinstall.mjs, so it must stay re-runnable: users are upserted on their unique
 * email, lists found by (user, title) before creating. `update: {}` is deliberate — editing a
 * fixture does not rewrite an existing row; delete it to re-seed.
 *
 * Documents are given loosely and completed by the API's own coercion (`coerceDesign`), the
 * same path every write takes.
 */
const prisma = new PrismaClient()

const PASSWORD = 'guests-dev-1234'

const id = (): string => randomBytes(5).toString('hex')

const TABLES: { name: string; guests: string[] }[] = [
  { name: 'Սեղան 1', guests: ['Արամ Պետրոսյան', 'Անի Պետրոսյան', 'Գագիկ Սարգսյան', 'Լիլիթ Սարգսյան', 'Վահե Հակոբյան', 'Մարիամ Հակոբյան'] },
  { name: 'Սեղան 2', guests: ['Տիգրան Մանուկյան', 'Նարե Մանուկյան', 'Սուրեն Գրիգորյան', 'Աննա Գրիգորյան', 'Դավիթ Ավետիսյան'] },
  { name: 'Սեղան 3', guests: ['Կարեն Մկրտչյան', 'Գոհար Մկրտչյան', 'Արմեն Խաչատրյան', 'Էլեն Խաչատրյան'] },
  { name: 'Սեղան 4', guests: ['Ռուբեն Ղազարյան', 'Թամարա Ղազարյան', 'Сергей Иванов', 'Мария Иванова', 'John Smith'] },
]

const wedding = () => {
  const tables = TABLES.map((table) => ({ id: id(), name: table.name }))
  const guests = TABLES.flatMap((table, index) => table.guests.map((name) => ({ id: id(), name, tableId: tables[index].id, note: '' })))
  return {
    title: 'Արամի և Անիի հարսանիքը',
    content: { heading: 'Բարի գալուստ', subheading: 'Արամ և Անի · 12 հունիսի 2027', footer: 'Շնորհակալություն, որ մեզ հետ եք', guests, tables },
    design: { kind: 'seating', templateId: 'ivory', tableStyle: 'boxed', palette: { background: '#fbf6ec', accent: '#b08d57', panel: '#f5ecdb' } },
  }
}

const christening = () => ({
  title: 'Կնունք',
  content: {
    heading: 'Հյուրերի ցուցակ',
    subheading: '',
    footer: '',
    guests: ['Նարեկ', 'Մանե', 'Սոնա', 'Հայկ', 'Լևոն'].map((name) => ({ id: id(), name, tableId: '', note: '' })),
    tables: [],
  },
  design: { kind: 'list', templateId: 'pastel', layout: { columns: 2, flow: 'columns' } },
})

type SeedUser = {
  email: string
  fullName: string
  lists: (() => { title: string; content: unknown; design: unknown })[]
  /** Templates the account has bought: a `succeeded` mock payment each, with no bank record to re-check. */
  templates?: string[]
}

const USERS: SeedUser[] = [
  // A brand-new account: empty dashboard, first-run experience.
  { email: 'demo@guests.local', fullName: 'Արամ Պետրոսյան', lists: [] },
  // A returning user: a seating board in a bought template and a plain list in an unbought one.
  { email: 'ani@guests.local', fullName: 'Անի Հովհաննիսյան', lists: [wedding, christening], templates: ['ivory'] },
]

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

const main = async (): Promise<void> => {
  const passwordHash = await hashPassword(PASSWORD)
  for (const seed of USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      // Verified, so they can sign in.
      update: { emailVerifiedAt: new Date() },
      create: { email: seed.email, fullName: seed.fullName, passwordHash, emailVerifiedAt: new Date() },
    })
    for (const make of seed.lists) {
      const fixture = make()
      if (await prisma.guestList.findFirst({ where: { userId: user.id, title: fixture.title } })) continue
      const content = coerceContent(fixture.content)
      const design = coerceDesign(fixture.design)
      await prisma.guestList.create({
        data: {
          userId: user.id,
          title: fixture.title,
          templateId: design.templateId,
          kind: design.kind,
          guestCount: content.guests.length,
          content: asJson(content),
          design: asJson(design),
        },
      })
    }
    for (const templateId of seed.templates ?? []) {
      if (await prisma.payment.findFirst({ where: { userId: user.id, templateId, status: 'succeeded' } })) continue
      await prisma.payment.create({
        data: { userId: user.id, templateId, amount: TEMPLATE_PRICE_AMD, gateway: 'mock', status: 'succeeded', paidAt: new Date() },
      })
    }
    const bought = seed.templates?.length ? `, bought ${seed.templates.join(', ')}` : ''
    console.log(`[seed] ${seed.email} / ${PASSWORD} — ${seed.lists.length} list(s)${bought}`)
  }
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
