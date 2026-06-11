import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { savingsGoalsApi } from '@/api/savingsGoals';
import { formatVND, formatShortDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function SavingsGoalDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);

  const [goal, setGoal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const [amountRaw, setAmountRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const g = await savingsGoalsApi.show(id);
      setGoal(g);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? 'Không tải được mục tiêu');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function submitContribute() {
    const amount = amountRaw ? parseInt(amountRaw, 10) : 0;
    if (!amount) return;

    setSubmitting(true);
    try {
      const res = await savingsGoalsApi.contribute(id, {
        amount,
        contributed_on: new Date().toISOString().slice(0, 10),
      });
      haptic.success();

      if (res.crossed_milestone) {
        const msg = res.crossed_milestone === 100
          ? `🎉 Bạn vừa hoàn thành mục tiêu "${goal.name}"!`
          : `🎯 Đã đạt ${res.crossed_milestone}% mục tiêu "${goal.name}"`;
        Alert.alert('Cột mốc mới!', msg);
      }

      setAmountRaw('');
      setShowContribute(false);
      await load();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? '');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Xoá "${goal?.name}"?`, 'Toàn bộ lịch sử đóng góp sẽ bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await savingsGoalsApi.delete(id);
            haptic.success();
            router.back();
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? '');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (!goal) return null;

  const percent = goal.progress_percent ?? 0;
  const completed = goal.status === 'completed';
  const amountInput = amountRaw ? parseInt(amountRaw, 10) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={[Typography.headingM, { flex: 1, marginLeft: 12 }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <Pressable onPress={confirmDelete} hitSlop={12}>
            <Ionicons name="trash-outline" size={22} color={Colors.expense} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
          {/* Hero progress */}
          <View style={[styles.hero, { backgroundColor: goal.color ?? Colors.primary }]}>
            <View style={styles.heroIcon}>
              <Ionicons name={(goal.icon as any) ?? 'flag'} size={28} color={goal.color ?? Colors.primary} />
            </View>
            <Text style={[Typography.bodyM, { color: 'rgba(28,28,30,0.7)', marginTop: 14 }]}>Đã tiết kiệm</Text>
            <Text style={[Typography.displayM, { color: Colors.dark, marginTop: 4 }]}>
              {formatVND(Number(goal.current_amount))}
            </Text>
            <Text style={[Typography.bodyS, { color: 'rgba(28,28,30,0.7)' }]}>
              / {formatVND(Number(goal.target_amount))}
            </Text>

            <View style={styles.heroBar}>
              <View style={[styles.heroBarFill, { width: `${Math.min(100, percent)}%` }]} />
            </View>
            <Text style={[Typography.moneyM, { color: Colors.dark, marginTop: 8 }]}>
              {Math.round(percent)}% — {completed ? 'Hoàn thành ✓' : `còn ${formatVND(Number(goal.target_amount) - Number(goal.current_amount))}`}
            </Text>
          </View>

          {/* Milestones */}
          <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 8 }]}>Cột mốc</Text>
          <View style={styles.milestoneRow}>
            {[25, 50, 75, 100].map((m) => {
              const reached = (goal.milestones_reached ?? []).includes(m);
              return (
                <View key={m} style={[styles.milestone, reached && { backgroundColor: Colors.income }]}>
                  {reached ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}
                  <Text style={[Typography.labelM, { color: reached ? Colors.white : Colors.textSecondary, marginLeft: reached ? 4 : 0 }]}>
                    {m}%
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Meta */}
          <View style={styles.metaCard}>
            <MetaRow label="Bắt đầu" value={formatShortDate(goal.started_at)} />
            {goal.target_date ? <MetaRow label="Đến hạn" value={formatShortDate(goal.target_date)} /> : null}
            {goal.days_left !== null && goal.days_left !== undefined ? (
              <MetaRow
                label="Còn lại"
                value={goal.days_left > 0 ? `${goal.days_left} ngày` : 'Đã đến hạn'}
                valueColor={goal.days_left < 30 ? Colors.warning : Colors.dark}
              />
            ) : null}
            <MetaRow label="Trạng thái" value={
              goal.status === 'active' ? 'Đang chạy' :
              goal.status === 'completed' ? 'Hoàn thành ✓' :
              goal.status === 'paused' ? 'Tạm dừng' : 'Đã từ bỏ'
            } />
          </View>

          {/* Contributions list */}
          {goal.contributions && goal.contributions.length > 0 ? (
            <>
              <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 8 }]}>Lịch sử đóng góp</Text>
              {goal.contributions.map((c: any) => (
                <View key={c.id} style={styles.contribRow}>
                  <View style={styles.contribDot} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={Typography.bodyM}>+ {formatVND(Number(c.amount))}</Text>
                    {c.notes ? <Text style={[Typography.caption, { color: Colors.textSecondary }]}>{c.notes}</Text> : null}
                  </View>
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>{formatShortDate(c.contributed_on)}</Text>
                </View>
              ))}
            </>
          ) : null}

          {/* Contribute form */}
          {!completed ? (
            <View style={styles.contributeBox}>
              {!showContribute ? (
                <Pressable onPress={() => setShowContribute(true)} style={styles.contributeBtn}>
                  <Ionicons name="add-circle" size={22} color={Colors.dark} />
                  <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 8 }]}>Thêm tiền tiết kiệm</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={[Typography.labelL, { marginBottom: 6 }]}>Số tiền</Text>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      value={amountRaw}
                      onChangeText={(v) => setAmountRaw(v.replace(/\D/g, '').slice(0, 14))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.grey400}
                      style={styles.input}
                      autoFocus
                    />
                    <Text style={styles.suffix}>₫</Text>
                  </View>
                  {amountInput > 0 ? (
                    <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>
                      {formatVND(amountInput)}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <Pressable
                      onPress={() => {
                        setShowContribute(false);
                        setAmountRaw('');
                      }}
                      style={styles.cancelBtn}
                    >
                      <Text style={[Typography.buttonM, { color: Colors.dark }]}>Huỷ</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton label="Thêm" onPress={submitContribute} loading={submitting} disabled={!amountInput} />
                    </View>
                  </View>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[Typography.bodyS, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[Typography.labelL, { color: valueColor ?? Colors.dark }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hero: { padding: Space.s20, borderRadius: Radius.xl, ...Shadow.green },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  heroBar: { height: 10, backgroundColor: 'rgba(28,28,30,0.2)', borderRadius: Radius.full, overflow: 'hidden', marginTop: 14 },
  heroBarFill: { height: '100%', backgroundColor: Colors.dark, borderRadius: Radius.full },
  milestoneRow: { flexDirection: 'row', gap: 8 },
  milestone: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.m,
    backgroundColor: Colors.grey200,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  metaCard: { marginTop: Space.s16, padding: 14, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  contribRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  contribDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.income },
  contributeBox: { marginTop: Space.s24, padding: 14, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  contributeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.dark,
    paddingRight: 50,
  },
  suffix: { position: 'absolute', right: 16, top: 14, fontSize: 18, color: Colors.textSecondary, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});
