import { useEffect } from 'react';
import { View, ActivityIndicator, Text, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/stores/auth';
import { Colors, Typography, Space } from '@/theme';

export default function Splash() {
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await hydrate();
      await new Promise((r) => setTimeout(r, 800));
      if (!mounted) return;
      const u = useAuth.getState().user;
      router.replace(u ? '/(tabs)' : '/(auth)/login');
    })();
    return () => {
      mounted = false;
    };
  }, [hydrate]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBg}>
        <Text style={styles.bee}>🐝</Text>
      </View>
      <Text style={[Typography.headingXL, { marginTop: Space.s24 }]}>BudgetBee</Text>
      <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 4 }]}>
        Quản lý tài chính thông minh
      </Text>
      <ActivityIndicator
        color={Colors.primary}
        size="large"
        style={{ marginTop: Space.s32 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  logoBg: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bee: { fontSize: 56 },
});
