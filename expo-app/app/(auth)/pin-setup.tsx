import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { secureStorage } from '@/services/secureStorage';
import { haptic } from '@/utils/haptics';

const KEYS: (string | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

export default function PinSetupScreen() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);

  const current = stage === 'enter' ? pin : confirmPin;
  const setCurrent = stage === 'enter' ? setPin : setConfirmPin;

  function onTap(key: string) {
    haptic.select();
    if (key === 'del') {
      setCurrent(current.slice(0, -1));
      setError(null);
      return;
    }
    if (current.length >= 6) return;
    const next = current + key;
    setCurrent(next);
    if (next.length === 6) {
      if (stage === 'enter') {
        setStage('confirm');
      } else {
        verify(pin, next);
      }
    }
  }

  async function verify(p1: string, p2: string) {
    if (p1 !== p2) {
      setError('Mã PIN không khớp, vui lòng thử lại');
      haptic.error();
      setPin('');
      setConfirmPin('');
      setStage('enter');
      return;
    }
    await secureStorage.savePinHash(p1);
    haptic.success();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ padding: Space.pageHorizontal, flex: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>

        <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>
          {stage === 'enter' ? 'Thiết lập mã PIN' : 'Nhập lại mã PIN'}
        </Text>
        <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
          {stage === 'enter' ? 'Mã 6 chữ số bảo vệ ứng dụng' : 'Xác nhận mã PIN vừa nhập'}
        </Text>

        <View style={styles.dots}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < current.length ? Colors.dark : 'transparent',
                  borderColor: i < current.length ? Colors.dark : Colors.border,
                },
              ]}
            />
          ))}
        </View>
        {error ? <Text style={[Typography.bodyM, { color: Colors.expense, textAlign: 'center', marginTop: 8 }]}>{error}</Text> : null}

        <View style={styles.padWrap}>
          {KEYS.map((k, i) => (
            <View key={i} style={styles.key}>
              {k === null ? null : (
                <Pressable
                  onPress={() => onTap(k)}
                  style={({ pressed }) => [styles.keyBtn, pressed && { opacity: 0.6 }]}
                >
                  {k === 'del' ? (
                    <Ionicons name="backspace-outline" size={26} color={Colors.dark} />
                  ) : (
                    <Text style={[Typography.headingXL]}>{k}</Text>
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: Space.s40 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  padWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 'auto', marginBottom: Space.s24 },
  key: { width: '33.333%', padding: 6, alignItems: 'center' },
  keyBtn: {
    width: '100%',
    height: 72,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
});
