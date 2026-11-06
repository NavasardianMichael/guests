import { describe, expect, it } from 'vitest'
import { MAX_GUESTS, MAX_TABLES, MIN_BLOCK_SIZE } from '@store/lists/single/store'
import { PRINT_KINDS, SHEET_SHAPES, TEXT_ROLES } from '@store/lists/single/types'
import { GUEST_COOKIE, RESET_TOKEN_QUERY, VERIFY_TOKEN_QUERY } from '@constants/auth'
import { ERROR_CODES } from '@constants/errors'
import { FONT_SLUGS } from '@constants/fonts'
import { PAPER_FORMATS, PAPER_LIMITS, PAPER_SIZES } from '@constants/paper'
import { LIST_PRICE_AMD } from '@constants/pricing'
import { RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { DEFAULT_TEMPLATE_ID, TABLE_STYLES, TEMPLATE_IDS, TEMPLATE_LIST } from '@constants/templates'
import { DEFAULT_LIST_TITLE, templateDesign } from '@helpers/listFactory'
import * as serverCatalogue from '../../../server/src/lib/catalogue'
import { DEFAULT_TEMPLATE_ID as SERVER_DEFAULT_TEMPLATE, FREE_TEMPLATE_IDS } from '../../../server/src/lib/catalogue'
import { ERROR_CODE } from '../../../server/src/lib/error-codes'
import * as guest from '../../../server/src/lib/guest'
import * as returnPath from '../../../server/src/lib/return-path'
import { coerceDesign, DEFAULT_LIST_TITLE as SERVER_DEFAULT_TITLE, LIST_LIMITS } from '../../../server/src/services/listDocument'
import { LIST_PRICE_AMD as SERVER_PRICE } from '../../../server/src/services/pricing'

/**
 * Strings and numbers that live twice, once per package, with no import path between them.
 * A mismatch typechecks on both sides and fails only at runtime: a font the API drops, a
 * paper size it rewrites, a price the page misquotes, an emailed link the page cannot read.
 */
describe('server/web twins', () => {
  it('agree on the template catalogue and which templates are free', () => {
    expect([...serverCatalogue.TEMPLATE_IDS]).toEqual([...TEMPLATE_IDS])
    expect([...FREE_TEMPLATE_IDS]).toEqual(TEMPLATE_LIST.filter((template) => template.free).map((template) => template.id))
    expect(SERVER_DEFAULT_TEMPLATE).toBe(DEFAULT_TEMPLATE_ID)
  })

  it('agree on the fonts, table styles, kinds, shapes and text roles', () => {
    expect([...serverCatalogue.SHEET_SHAPES]).toEqual([...SHEET_SHAPES])
    expect([...serverCatalogue.FONT_SLUGS]).toEqual([...FONT_SLUGS])
    expect([...serverCatalogue.TABLE_STYLES]).toEqual([...TABLE_STYLES])
    expect([...serverCatalogue.PRINT_KINDS].sort()).toEqual([...PRINT_KINDS].sort())
    expect([...serverCatalogue.TEXT_ROLES]).toEqual([...TEXT_ROLES])
  })

  it('agree on paper', () => {
    expect([...serverCatalogue.PAPER_FORMATS]).toEqual([...PAPER_FORMATS])
    expect(serverCatalogue.PAPER_SIZES).toEqual(PAPER_SIZES)
    expect(serverCatalogue.PAPER_LIMITS).toEqual(PAPER_LIMITS)
  })

  it('agree on how many guests and tables a list holds', () => {
    expect(LIST_LIMITS.guests).toBe(MAX_GUESTS)
    expect(LIST_LIMITS.tables).toBe(MAX_TABLES)
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

  it('charge what the pages print', () => {
    expect(SERVER_PRICE).toBe(LIST_PRICE_AMD)
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
  })
})
