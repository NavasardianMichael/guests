import { theme, type ThemeConfig } from 'antd'
import { APRICOT, CANVAS, CSS_VAR_SCOPE, FONT_SIZE, INK, RADIUS, STATUS } from './tokens'

export const antdTheme: ThemeConfig = {
  cssVar: { prefix: 'ant', key: CSS_VAR_SCOPE },
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: INK[900],
    colorInfo: STATUS.info,
    colorSuccess: STATUS.success,
    colorWarning: STATUS.warning,
    colorError: STATUS.danger,
    colorLink: INK[700],
    colorText: INK[900],
    colorTextSecondary: INK[500],
    colorBorder: CANVAS.line,
    colorBorderSecondary: CANVAS.line,
    colorBgLayout: CANVAS.base,
    colorBgContainer: CANVAS.raised,
    borderRadius: RADIUS.sm,
    borderRadiusLG: RADIUS.md,
    fontSize: FONT_SIZE.base - 1,
    fontFamily: 'var(--font-ui), system-ui, sans-serif',
    controlHeight: 38,
    controlHeightLG: 46,
    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      fontWeight: 600,
    },
    /** The chosen option sits on solid ink, so its text must be light to stay readable. */
    Select: {
      optionSelectedBg: INK[900],
      optionSelectedColor: CANVAS.raised,
      optionActiveBg: INK[50],
      // Selected *and* keyboard-active (the state it opens in) uses this global token instead,
      // which otherwise derives a mid grey from colorPrimary.
      controlItemBgActiveHover: INK[800],
    },
    /** The label sits close to its field (antd's default is 8px below it). */
    Form: {
      verticalLabelPadding: '0 0 4px',
    },
    Segmented: {
      itemSelectedBg: CANVAS.raised,
      trackBg: CANVAS.sunken,
    },
    Tabs: {
      inkBarColor: APRICOT[500],
      itemSelectedColor: INK[900],
      itemHoverColor: INK[700],
    },
    Slider: {
      trackBg: APRICOT[500],
      trackHoverBg: APRICOT[600],
      handleColor: APRICOT[500],
      handleActiveColor: APRICOT[600],
    },
  },
}
