/**
 * Design constants for the app's own chrome. A raw hex for the UI may appear in THIS FILE
 * ONLY; it flows tokens.ts -> theme.ts -> antd ConfigProvider (cssVar) -> :root{--ant-*}
 * -> globals.css aliases -> Tailwind utilities.
 *
 * CV colours are document data, not UI: they live in `src/constants/templates.ts` and
 * `palettes.ts` and reach a CV only as `--cv-*` variables.
 *
 * Ink navy for text and surfaces, apricot (ծիրան) as the accent.
 */
export const INK = {
  50: '#f3f4f8',
  100: '#e4e6ef',
  200: '#c8cce0',
  300: '#a0a6c5',
  400: '#7179a3',
  500: '#525b86',
  600: '#3d456d',
  700: '#2f365a',
  800: '#252b4b',
  900: '#1d2340',
  950: '#121629',
} as const

export const APRICOT = {
  50: '#fff6ec',
  100: '#ffe9d1',
  200: '#ffd0a1',
  300: '#ffb067',
  400: '#f9963c',
  500: '#f08a24',
  600: '#d96f12',
  700: '#b45512',
  800: '#8f4416',
  900: '#743915',
} as const

export const CANVAS = {
  base: '#faf7f2',
  raised: '#ffffff',
  sunken: '#f3eee6',
  line: '#e8e1d6',
} as const

export const STATUS = {
  success: '#12976b',
  warning: '#c2870b',
  danger: '#d92d3a',
  info: '#2f6fdb',
} as const

export const RADIUS = { sm: 8, md: 12, lg: 18 } as const

export const FONT_SIZE = { base: 15 } as const

/** Variables antd has no slot for, set on <html> by the root layout and aliased in globals.css. */
export const BRAND_CSS_VARS = {
  '--brand-accent': APRICOT[500],
  '--brand-accent-strong': APRICOT[600],
  '--brand-accent-soft': APRICOT[100],
  '--brand-ink-soft': INK[100],
  '--brand-ink-deep': INK[950],
} as const

/** The class antd scopes its `--ant-*` block to; put on <html> so it lands on :root. */
export const CSS_VAR_SCOPE = 'rz'
