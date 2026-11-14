import { describe, expect, it } from 'vitest'
import { checkDeployConfig, parseEnvFile } from '../../scripts/check-deploy-config.mjs'

const SITE = 'https://guests-seating-board.eapps.site'
const API = 'https://api.guests-seating-board.eapps.site'

const API_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://guests:0123abcd@127.0.0.1:5010/guests?schema=public&connection_limit=5',
  JWT_SECRET: `"${'a'.repeat(64)}"`,
  CORS_ORIGIN: SITE,
  API_PUBLIC_URL: API,
  GEMINI_API_KEY: 'key',
  MAIL_API_URL: 'https://mail.example.com',
  MAIL_API_KEY: 'key',
  PAYMENT_GATEWAY: 'ameria',
  AMERIA_CLIENT_ID: 'client',
  AMERIA_USERNAME: 'user',
  AMERIA_PASSWORD: 'password',
  AMERIA_TEST_MODE: 'false',
}

const encode = (values: Record<string, string>): string =>
  Buffer.from(
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\r\n')
  ).toString('base64')

const environment = (overrides: Record<string, string> = {}, api: Record<string, string> = API_ENV) => ({
  DEPLOY_WEB: 'true',
  DEPLOY_API: 'true',
  SSH_HOST: '203.0.113.7',
  SSH_USER: 'michael',
  SSH_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
  APP_DIR: '/home/michael/apps/guests-seating-board',
  ENV_API_BASE64: encode(api),
  NEXT_PUBLIC_API_URL: API,
  NEXT_PUBLIC_SITE_URL: SITE,
  ...overrides,
})

const errorsOf = (overrides: Record<string, string> = {}, api?: Record<string, string>) => checkDeployConfig(environment(overrides, api)).errors

describe('checkDeployConfig', () => {
  it('passes a complete production configuration with no errors or warnings', () => {
    expect(checkDeployConfig(environment())).toEqual({ errors: [], warnings: [] })
  })

  it('refuses missing server access secrets', () => {
    expect(errorsOf({ SSH_KEY: '' })).toEqual([expect.stringContaining('SSH_KEY is empty')])
    expect(errorsOf({ SSH_KEY: 'ssh-ed25519 AAAA public half' })).toEqual([expect.stringContaining('not a private key')])
    expect(errorsOf({ APP_DIR: 'apps/guests' })).toEqual([expect.stringContaining('absolute path')])
    expect(errorsOf({ SSH_PORT: '22a' })).toEqual([expect.stringContaining('SSH_PORT')])
  })

  it('refuses a loopback or http origin for the web build', () => {
    expect(errorsOf({ NEXT_PUBLIC_SITE_URL: 'http://localhost:7010' })).toEqual([
      expect.stringContaining('NEXT_PUBLIC_SITE_URL must be a public https'),
      expect.stringContaining('CORS_ORIGIN in ENV_API_BASE64 must equal NEXT_PUBLIC_SITE_URL'),
    ])
    expect(errorsOf({ NEXT_PUBLIC_API_URL: '' })).toEqual([expect.stringContaining('NEXT_PUBLIC_API_URL is empty')])
  })

  it('refuses a short, missing or default JWT_SECRET', () => {
    for (const JWT_SECRET of ['short', '', 'dev-secret-change-me', 'change-me-in-production-use-long-random-string']) {
      expect(errorsOf({}, { ...API_ENV, JWT_SECRET })).toEqual([expect.stringContaining('JWT_SECRET')])
    }
  })

  it('refuses origins that differ from the web build', () => {
    expect(errorsOf({}, { ...API_ENV, CORS_ORIGIN: 'https://www.guests-seating-board.eapps.site' })).toEqual([expect.stringContaining('must equal NEXT_PUBLIC_SITE_URL')])
    expect(errorsOf({}, { ...API_ENV, CORS_ORIGIN: `${SITE}/` })).toEqual([])
    expect(errorsOf({}, { ...API_ENV, API_PUBLIC_URL: 'http://localhost:9010' })).toEqual([expect.stringContaining('API_PUBLIC_URL')])
  })

  it('refuses a database URL the first deploy cannot turn into compose credentials', () => {
    expect(errorsOf({}, { ...API_ENV, DATABASE_URL: 'postgresql://guests:pa%24s@127.0.0.1:5010/guests' })).toEqual([expect.stringContaining('password')])
    expect(errorsOf({}, { ...API_ENV, DATABASE_URL: '' })).toEqual([expect.stringContaining('no DATABASE_URL')])
  })

  it('refuses half-configured payments and the test amount on the live terminal', () => {
    const { AMERIA_PASSWORD: _password, ...noPassword } = API_ENV
    expect(errorsOf({}, noPassword)).toEqual([expect.stringContaining('AMERIA_PASSWORD')])
    expect(errorsOf({}, { ...API_ENV, AMERIA_AMOUNT_OVERRIDE: '10' })).toEqual([expect.stringContaining('AMERIA_AMOUNT_OVERRIDE')])
    expect(errorsOf({}, { ...API_ENV, AMERIA_TEST_MODE: 'true', AMERIA_AMOUNT_OVERRIDE: '10' })).toEqual([])
  })

  it('refuses an ENV_API_BASE64 that is not base64 of an env file', () => {
    expect(errorsOf({ ENV_API_BASE64: 'not base64!' })).toEqual([expect.stringContaining('does not decode')])
  })

  it('checks only the sides being deployed', () => {
    expect(errorsOf({ DEPLOY_API: 'false', ENV_API_BASE64: '' })).toEqual([])
    expect(errorsOf({ DEPLOY_WEB: 'false', NEXT_PUBLIC_API_URL: '' })).toEqual([])
  })

  it('warns, without failing, when optional features are off', () => {
    const { warnings, errors } = checkDeployConfig(environment({}, { ...API_ENV, GEMINI_API_KEY: '', AMERIA_TEST_MODE: 'true' }))
    expect(errors).toEqual([])
    expect(warnings).toEqual([expect.stringContaining('test terminal'), expect.stringContaining('GEMINI_API_KEY')])
  })
})

describe('parseEnvFile', () => {
  it('reads values literally and drops one pair of surrounding quotes', () => {
    expect(parseEnvFile('A="x&y"\r\nB=\'$z\'\n# comment\nC=plain=1')).toEqual({ A: 'x&y', B: '$z', C: 'plain=1' })
  })
})
