import { Pressable, StyleSheet, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, Radius, Typography } from '@/theme';
import { haptic } from '@/utils/haptics';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'dark' | 'ghost' | 'outline';
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const isDark = variant === 'dark';
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        isDark && { backgroundColor: Colors.dark },
        isGhost && { backgroundColor: 'transparent' },
        isOutline && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
        (disabled || loading) && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? Colors.primary : Colors.dark} />
      ) : (
        <Text
          style={[
            Typography.buttonL,
            { color: isDark ? Colors.primary : isGhost || isOutline ? Colors.primary : Colors.textOnPrimary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
