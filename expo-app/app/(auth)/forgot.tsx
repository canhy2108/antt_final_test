import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { haptic } from '@/utils/haptics';

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes('@')) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    haptic.success();
    Alert.alert('Đã gửi', 'Mã đặt lại đã gửi tới email của bạn.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/otp' as any) },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.wrap}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Quên mật khẩu</Text>
        <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
          Nhập email để nhận mã đặt lại mật khẩu
        </Text>
        <View style={{ marginTop: Space.s24 }}>
          <TextField
            label="Email"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        <PrimaryButton label="Gửi mã đặt lại" onPress={submit} loading={loading} style={{ marginTop: Space.s24 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Space.pageHorizontal, flex: 1 },
});
