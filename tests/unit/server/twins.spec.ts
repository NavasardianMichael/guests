import { describe, expect, it } from 'vitest'
import { MAX_GUESTS, MAX_SEATS, MAX_TABLES, MAX_VENUE_ITEMS, MIN_BLOCK_SIZE } from '@store/lists/single/store'
import { PLAN_ARRANGEMENTS, PRINT_KINDS, SHEET_SHAPES, TABLE_SHAPES, TEXT_ROLES, VENUE_KINDS } from '@store/lists/single/types'
import { GUEST_COOKIE, RESET_TOKEN_QUERY, VERIFY_TOKEN_QUERY } from '@constants/auth'
import { ERROR_CODES } from '@constants/errors'
import { FONT_SLUGS } from '@constants/fonts'
import { PAPER_FORMATS, PAPER_LIMITS, PAPER_SIZES } from '@constants/paper'
import { PASS_DAYS, PASS_PRICE_AMD, PHOTO_READS_PER_PASS, RETENTION_DAYS } from '@constants/pricing'
import { PAYMENT_RESULT_STATUSES, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { DEFAULT_TEMPLATE_ID, isTemplateId, TABLE_STYLES, TEMPLATE_IDS, TEMPLATE_LIST } from '@constants/templates'
import type { ClientInfo } from '@helpers/clientInfo'
import { DEFAULT_LIST_TITLE, templateDesign } from '@helpers/listFactory'
import * as serverCatalogue from '../../../server/src/lib/catalogue'
import { DEFAULT_TEMPLATE_ID as SERVER_DEFAULT_TEMPLATE, FREE_TEMPLATE_IDS } from '../../../server/src/lib/catalogue'
import { ERROR_CODE } from '../../../server/src/lib/error-codes'
import * as guest from '../../../server/src/lib/guest'
import { asClientInfo } from '../../../server/src/lib/request-info'
import * as returnPath from '../../../server/src/lib/return-path'
import { coerceDesign, DEFAULT_LIST_TITLE as SERVER_DEFAULT_TITLE, LIST_LIMITS } from '../../../server/src/services/listDocument'
import { PHOTO_READS_PER_PASS as SERVER_PHOTO_READS } from '../../../server/src/services/photoQuota'
import { PASS_DAYS as SERVER_PASS_DAYS, PASS_PRICE_AMD as SERVER_PRICE } from '../../../server/src/services/pricing'
import { RETENTION_DAYS as SERVER_RETENTION_DAYS } from '../../../server/src/services/retention'

/**
 * Strings and numbers that live twice, once per package, with no import path between them.
 * A mismatch typechecks on both sides and fails only at runtime: a font the API drops, a
 * paper size it rewrites, a price the page misquotes, an emailed link the page cannot read.
 */
describe('server/web twins', () => {
  it('agree on the template catalogue and which templates are free', () => {
    expect([...serverCatalogue.TEMPLATE_IDS]).toEqual([...TEMPLATE_IDS])
    expect(serverCatalogue.isTemplateId('ivory')).toBe(isTemplateId('ivory'))
    expect(serverCatalogue.isTemplateId('nope')).toBe(isTemplateId('nope'))
    expect([...FREE_TEMPLATE_IDS]).toEqual(TEMPLATE_LIST.filter((template) => template.free).map((template) => template.id))
    expect(SERVER_DEFAULT_TEMPLATE).toBe(DEFAULT_TEMPLATE_ID)
  })

  it('agree on the fonts, table styles, kinds, shapes and text roles', () => {
    expect([...serverCatalogue.SHEET_SHAPES]).toEqual([...SHEET_SHAPES])
    expect([...serverCatalogue.FONT_SLUGS]).toEqual([...FONT_SLUGS])
    expect([...serverCatalogue.TABLE_STYLES]).toEqual([...TABLE_STYLES])
    expect([...serverCatalogue.PRINT_KINDS].sort()).toEqual([...PRINT_KINDS].sort())
    expect([...serverCatalogue.TEXT_ROLES]).toEqual([...TEXT_ROLES])
    expect([...serverCatalogue.TABLE_SHAPES]).toEqual([...TABLE_SHAPES])
    expect([...serverCatalogue.VENUE_KINDS]).toEqual([...VENUE_KINDS])
    expect([...serverCatalogue.PLAN_ARRANGEMENTS]).toEqual([...PLAN_ARRANGEMENTS])
  })

  it('agree on paper', () => {
    expect([...serverCatalogue.PAPER_FORMATS]).toEqual([...PAPER_FORMATS])
    expect(serverCatalogue.PAPER_SIZES).toEqual(PAPER_SIZES)
    expect(serverCatalogue.PAPER_LIMITS).toEqual(PAPER_LIMITS)
  })

  it('agree on how many guests and tables a list holds', () => {
    expect(LIST_LIMITS.guests).toBe(MAX_GUESTS)
    expect(LIST_LIMITS.tables).toBe(MAX_TABLES)
    expect(LIST_LIMITS.venue).toBe(MAX_VENUE_ITEMS)
    expect(LIST_LIMITS.seats).toBe(MAX_SEATS)
    expect({ w: LIST_LIMITS.minBlockW, h: LIST_LIMITS.minBlockH }).toEqual(MIN_BLOCK_SIZE)
  })

  it('keep every template design exactly as the web makes it', () => {
    for (const id of TEMPLATE_IDS) {
      for (const kind of PRINT_KINDS) {
        for (const shape of SHEET_SHAPES) {
          const design = templateDesign(id, kind, shape)
          expect(coerceDesign(design)).toEqual(design)
        }
      }
    }
  })

  it('charge what the pages print, for as many days, and delete when they say', () => {
    expect(SERVER_PRICE).toBe(PASS_PRICE_AMD)
    expect(SERVER_PASS_DAYS).toBe(PASS_DAYS)
    expect(SERVER_RETENTION_DAYS).toBe(RETENTION_DAYS)
    expect(SERVER_PHOTO_READS).toBe(PHOTO_READS_PER_PASS)
  })

  it('name the guest cookie the proxy looks for', () => {
    expect(guest.GUEST_COOKIE).toBe(GUEST_COOKIE)
  })

  it('title an untitled list the same way', () => {
    expect(SERVER_DEFAULT_TITLE).toBe(DEFAULT_LIST_TITLE)
  })

  it('agree on every error code', () => {
    expect(ERROR_CODE).toEqual(ERROR_CODES)
  })

  it('build links the pages read', () => {
    expect(returnPath.PASSWORD_RESET_PATH).toBe(ROUTES.resetPassword)
    expect(returnPath.PASSWORD_RESET_QUERY).toBe(RESET_TOKEN_QUERY)
    expect(returnPath.FORGOT_PASSWORD_PATH).toBe(ROUTES.forgotPassword)
    expect(returnPath.EMAIL_VERIFY_PATH).toBe(ROUTES.verifyEmail)
    expect(returnPath.EMAIL_VERIFY_QUERY).toBe(VERIFY_TOKEN_QUERY)
    expect(returnPath.RETURN_TO_QUERY).toBe(RETURN_TO_QUERY)
    expect(returnPath.SIGN_IN_PATH).toBe(ROUTES.signIn)
    expect(returnPath.DASHBOARD_PATH).toBe(ROUTES.dashboard)
    expect(returnPath.PAYMENT_RESULT_PATH).toBe(ROUTES.paymentResult)
    expect(returnPath.PAYMENT_RESULT_STATUSES).toEqual(PAYMENT_RESULT_STATUSES)
  })

  it('keep every device fact the checkout sends', () => {
    // `Required` makes a new web key fail to compile here until it is added.
    const everything: Required<ClientInfo> = {
      timezone: 'Asia/Yerevan',
      languages: 'hy-AM, en',
      platform: 'Android',
      mobile: true,
      screen: '412×915',
      viewport: '412×800',
      pixelRatio: 2.625,
      touchPoints: 5,
      cores: 8,
      memoryGb: 8,
      connection: '4g, ~10 Mbps',
      colorScheme: 'dark',
      standalone: false,
    }
    expect(Object.keys(asClientInfo(everything)).sort()).toEqual(Object.keys(everything).sort())
  })
})
