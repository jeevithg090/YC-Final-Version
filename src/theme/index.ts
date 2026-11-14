/**
 * YOGO Campus design tokens.
 *
 * One source of truth for colour, spacing, radius, typography and elevation.
 * New and refactored screens should use these values (via `theme` or the
 * primitives in `src/components/ui`) instead of hard-coded numbers and hex codes.
 *
 * Colour pairs listed under "on*" are checked for WCAG AA contrast (≥ 4.5:1
 * for body text) against the surface they are meant to sit on.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const palette = {
  indigo50: '#EEF0FF',
  indigo100: '#DDE0FB',
  indigo200: '#BCC0F7',
  indigo400: '#8F94FB',
  indigo500: '#4E54C8', // brand primary (6.1:1 on white)
  indigo600: '#3F45AE',
  indigo700: '#33388F',
  indigo900: '#1A1D4E',
  blue700: '#1A53AC', // logo background
  orange500: '#FF7533', // logo accent
  orange700: '#B4461A',
  gray0: '#FFFFFF',
  gray50: '#F6F7FB',
  gray100: '#EEF0F5',
  gray200: '#E0E3EB',
  gray300: '#C9CED9',
  gray500: '#6B7280', // 4.8:1 on white
  gray600: '#4B5263',
  gray800: '#252A37',
  gray900: '#141824',
  red50: '#FDECEC',
  red600: '#C62828', // 5.6:1 on white
  green50: '#E8F5EC',
  green700: '#1E7B3A', // 5.4:1 on white
  amber50: '#FFF6E5',
  amber800: '#8A5300', // 5.9:1 on white
} as const;

export const colors = {
  primary: palette.indigo500,
  primaryPressed: palette.indigo600,
  primarySoft: palette.indigo50,
  primaryGradient: [palette.indigo500, palette.indigo400] as const,
  heroGradient: [palette.indigo900, palette.indigo500] as const,
  onPrimary: palette.gray0,
  accent: palette.orange500,

  background: palette.gray50,
  surface: palette.gray0,
  surfaceMuted: palette.gray100,
  border: palette.gray200,
  borderStrong: palette.gray300,

  text: palette.gray900,
  textMuted: palette.gray600,
  textSubtle: palette.gray500,
  placeholder: palette.gray500,
  onDark: palette.gray0,
  onDarkMuted: 'rgba(255,255,255,0.86)',

  danger: palette.red600,
  dangerSoft: palette.red50,
  success: palette.green700,
  successSoft: palette.green50,
  warning: palette.amber800,
  warningSoft: palette.amber50,

  focusRing: palette.indigo400,
  overlay: 'rgba(20,24,36,0.55)',
} as const;

/** 4-point spacing scale. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum size for anything tappable (WCAG 2.5.5 / platform guidelines). */
export const touchTarget = 48;

/** Widest a form or reading column should get on tablets and desktop. */
export const layout = {
  formMaxWidth: 440,
  contentMaxWidth: 720,
  wideMaxWidth: 1080,
} as const;

const fontFamily = Platform.select({
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

const font = (size: number, lineHeight: number, weight: TextStyle['fontWeight']): TextStyle => ({
  fontSize: size,
  lineHeight,
  fontWeight: weight,
  ...(fontFamily ? { fontFamily } : {}),
});

export const typography = {
  display: font(34, 40, '800'),
  title: font(26, 32, '700'),
  heading: font(20, 26, '700'),
  subheading: font(17, 24, '600'),
  body: font(16, 24, '400'),
  bodyStrong: font(16, 24, '600'),
  label: font(14, 20, '600'),
  caption: font(13, 18, '400'),
  button: font(16, 20, '700'),
} satisfies Record<string, TextStyle>;

export const elevation = {
  none: {} as ViewStyle,
  sm: Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(20,24,36,0.06), 0 1px 3px rgba(20,24,36,0.08)' } as ViewStyle,
    default: {
      shadowColor: '#141824',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
  }),
  md: Platform.select<ViewStyle>({
    web: { boxShadow: '0 4px 12px rgba(20,24,36,0.08), 0 2px 4px rgba(20,24,36,0.06)' } as ViewStyle,
    default: {
      shadowColor: '#141824',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
  }),
} as const;

export const motion = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export const theme = { palette, colors, spacing, radius, typography, elevation, layout, motion, touchTarget };
export type Theme = typeof theme;
export default theme;
