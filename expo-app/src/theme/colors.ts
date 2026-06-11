export const Colors = {
  primary: '#BDE83E',
  primaryLight: '#D4F26A',
  primaryDark: '#9ACF1A',

  gradientStart: '#BDE83E',
  gradientEnd: '#6DB33F',

  black: '#111111',
  dark: '#1C1C1E',
  grey900: '#212121',
  grey800: '#424242',
  grey600: '#757575',
  grey400: '#BDBDBD',
  grey200: '#EEEEEE',
  grey100: '#F5F5F5',
  white: '#FFFFFF',

  background: '#F2F2F4',
  surface: '#FFFFFF',
  surfaceDark: '#1C1C1E',

  income: '#22C55E',
  expense: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  darkBackground: '#0A0A0A',
  darkSurface: '#1C1C1E',
  darkSurface2: '#2C2C2E',

  textPrimary: '#111111',
  textSecondary: '#8E8E93',
  textDisabled: '#BDBDBD',
  textOnPrimary: '#111111',
  textOnDark: '#FFFFFF',

  overlayDark: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(255,255,255,0.2)',

  border: '#E5E7EB',
  borderFocus: '#BDE83E',
} as const;

export type ColorKey = keyof typeof Colors;
