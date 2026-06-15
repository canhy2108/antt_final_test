import { Platform, ViewStyle } from 'react-native';

export const Radius = {
  xs: 8,
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
  full: 999,
} as const;

export const Space = {
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s40: 40,
  s48: 48,
  s56: 56,
  s64: 64,
  pageHorizontal: 20,
} as const;

const androidElevation = (e: number): ViewStyle =>
  Platform.OS === 'android' ? { elevation: e } : {};

export const Shadow = {
  s: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    ...androidElevation(2),
  } as ViewStyle,
  m: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    ...androidElevation(6),
  } as ViewStyle,
  l: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    ...androidElevation(10),
  } as ViewStyle,
  green: {
    shadowColor: '#BDE83E',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    ...androidElevation(12),
  } as ViewStyle,
} as const;
