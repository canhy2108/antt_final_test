import { TextStyle } from 'react-native';
import { Colors } from './colors';

// Use the platform system font. A custom 'Inter' family must be registered via
// expo-font before it can be referenced, otherwise text rendering crashes on the
// new architecture. Re-enable by loading Inter in app/_layout.tsx and setting this.
const fontFamily: string | undefined = undefined;

/**
 * Using `satisfies` (not a typed annotation) so each entry keeps its narrow
 * literal types. The previous `Record<string, TextStyle>` cast widened
 * properties like `userSelect` to `string | undefined`, which then refused
 * to merge with TextInput's stricter style union on RN 0.81 / React 19.
 */
export const Typography = {
  displayXL: { fontFamily, fontSize: 40, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  displayL: { fontFamily, fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.8 },
  displayM: { fontFamily, fontSize: 28, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },

  moneyXL: { fontFamily, fontSize: 36, fontWeight: '800', color: Colors.white, letterSpacing: -1 },
  moneyL: { fontFamily, fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  moneyM: { fontFamily, fontSize: 20, fontWeight: '600', color: Colors.textPrimary },
  moneyS: { fontFamily, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  headingXL: { fontFamily, fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  headingL: { fontFamily, fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  headingM: { fontFamily, fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  headingS: { fontFamily, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  bodyL: { fontFamily, fontSize: 16, fontWeight: '400', color: Colors.textPrimary, lineHeight: 24 },
  bodyM: { fontFamily, fontSize: 14, fontWeight: '400', color: Colors.textPrimary, lineHeight: 21 },
  bodyS: { fontFamily, fontSize: 12, fontWeight: '400', color: Colors.textSecondary, lineHeight: 17 },

  labelL: { fontFamily, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  labelM: { fontFamily, fontSize: 12, fontWeight: '500', color: Colors.textSecondary, letterSpacing: 0.2 },
  caption: { fontFamily, fontSize: 11, fontWeight: '400', color: Colors.textSecondary, letterSpacing: 0.1 },

  buttonL: { fontFamily, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  buttonM: { fontFamily, fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
} satisfies Record<string, TextStyle>;
