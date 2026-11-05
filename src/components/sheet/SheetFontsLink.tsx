import type { FC } from 'react'
import { SHEET_FONTS_STYLESHEET } from '@constants/fonts'

/**
 * The sheet typefaces' `@font-face` rules. Linked only on pages that draw sheets, so the
 * landing page's critical path stays free of them; a face downloads only when used.
 * React 19 hoists a `<link rel="stylesheet" precedence>` into <head> and dedupes it.
 */
export const SheetFontsLink: FC = () => <link rel='stylesheet' href={SHEET_FONTS_STYLESHEET} precedence='default' />
