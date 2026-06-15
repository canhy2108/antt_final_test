import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Typography } from '@/theme';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  errorText?: string;
  secureToggle?: boolean;
}

export function TextField({ label, icon, errorText, secureToggle, secureTextEntry, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={{ width: '100%' }}>
      {label ? <Text style={[Typography.labelL, { marginBottom: 8 }]}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          focused && { borderColor: Colors.primary, borderWidth: 2 },
          errorText && { borderColor: Colors.expense },
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} /> : null}
        <TextInput
          {...rest}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={Colors.textDisabled}
          style={[styles.input, Typography.bodyL, style]}
        />
        {secureToggle ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={12}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {errorText ? (
        <Text style={[Typography.caption, { color: Colors.expense, marginTop: 6 }]}>{errorText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 56,
    borderRadius: Radius.m,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.textPrimary,
  },
});
