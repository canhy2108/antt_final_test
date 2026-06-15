import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { savingsGoalsApi } from '@/api/savingsGoals';
import { formatVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const PRESETS = [
  { name: 'MacBook Pro', icon: 'laptop', color: '#A1A1AA', target: 50_000_000 },
  { name: 'iPhone mới', icon: 'phone-portrait', color: '#3B82F6', target: 30_000_000 },
  { name: 'Du lịch', icon: 'airplane', color: '#F59E0B', target: 20_000_000 },
  { name: 'Học thêm', icon: 'school', color: '#A855F7', target: 15_000_000 },
  { name: 'Quỹ khẩn cấp', icon: 'shield-checkmark', color: '#EF4444', target: 100_000_000 },
  { name: 'Khác', icon: 'flag', color: '#BDE83E', target: 0 },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function NewSavingsGoalScreen() {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('flag');
  const [color, setColor] = useState<string>('#BDE83E');
  const [targetRaw, setTargetRaw] = useState('');
  const [monthsAhead, setMonthsAhead] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = targetRaw ? parseInt(targetRaw, 10) : 0;
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthsAhead);

  function applyPreset(p: typeof PRESETS[number]) {
    haptic.light();
    setName(p.name === 'Khác' ? '' : p.name);
    setIcon(p.icon);
    setColor(p.color);
    if (p.target > 0) setTargetRaw(String(p.target));
  }

  async function submit() {
    if (!name.trim()) {
      setError('Vui lòng đặt tên mục tiêu');
      haptic.error();
      return;
    }
    if (!target || target < 10_000) {
      setError('Số tiền mục tiêu phải ≥ 10,000 ₫');
      haptic.error();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await savingsGoalsApi.create({
        name: name.trim(),
        target_amount: target,
        started_at: ymd(new Date()),
        target_date: ymd(targetDate),
        icon,
        color,
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Không tạo được mục tiêu');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={Typography.headingM}>Mục tiêu mới</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[Typography.labelL, { marginBottom: 10 }]}>Chọn mẫu nhanh</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map((p) => {
              const active = name === p.name || (p.name === 'Khác' && !PRESETS.slice(0, -1).find((x) => x.name === name));
              return (
                <Pressable
                  key={p.name}
                  onPress={() => applyPreset(p)}
                  style={[styles.preset, active && { borderColor: p.color, borderWidth: 2 }]}
                >
                  <View style={[styles.presetIcon, { backgroundColor: p.color + '20' }]}>
                    <Ionicons name={p.icon as any} size={20} color={p.color} />
                  </View>
                  <Text style={[Typography.caption, { marginTop: 4, fontWeight: '700' }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Tên mục tiêu</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError(null);
            }}
            placeholder="VD: Mua MacBook M4 Pro"
            placeholderTextColor={Colors.grey400}
            style={styles.input}
          />

          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Số tiền mục tiêu</Text>
          <View style={styles.amountWrap}>
            <TextInput
              value={targetRaw}
              onChangeText={(v) => {
                setTargetRaw(v.replace(/\D/g, '').slice(0, 14));
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.grey400}
              style={[styles.input, { paddingRight: 60, flex: 1 }]}
            />
            <Text style={styles.amountSuffix}>₫</Text>
          </View>
          {target > 0 ? (
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>{formatVND(target)}</Text>
          ) : null}

          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Thời gian</Text>
          <View style={styles.monthRow}>
            {[3, 6, 12, 24].map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  haptic.light();
                  setMonthsAhead(m);
                }}
                style={[styles.monthChip, monthsAhead === m && { backgroundColor: Colors.dark }]}
              >
                <Text style={[Typography.labelM, { color: monthsAhead === m ? Colors.primary : Colors.dark }]}>
                  {m} tháng
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 6 }]}>
            Đến ngày {targetDate.toLocaleDateString('vi-VN')}
            {target > 0 ? ` — cần để dành ${formatVND(Math.ceil(target / monthsAhead))} mỗi tháng` : ''}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.expense} />
              <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 8, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton label="Tạo mục tiêu" onPress={submit} loading={submitting} style={{ marginTop: Space.s24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    width: '31%',
    padding: 10,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  presetIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.dark,
  },
  amountWrap: { position: 'relative', justifyContent: 'center' },
  amountSuffix: { position: 'absolute', right: 16, fontSize: 18, color: Colors.textSecondary, fontWeight: '700' },
  monthRow: { flexDirection: 'row', gap: 8 },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.s16,
    padding: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.expense + '15',
  },
});
