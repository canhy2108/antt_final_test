import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { categoriesApi, Category } from '@/api/categories';
import { budgetsApi } from '@/api/budgets';
import { formatVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function NewBudgetScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<Category | null>(null);
  const [amountRaw, setAmountRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await categoriesApi.getAll();
        // Keep only expense-looking categories (where you'd budget against)
        const expense = all.filter((c) => /expense|chi|food|eat|trans|shop|bill/i.test(c.parent_name ?? ''));
        setCategories(expense.length > 0 ? expense : all);
      } catch (e: any) {
        setError(e?.message ?? 'Không tải được danh mục');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function pick(cat: Category) {
    haptic.light();
    setPicked(cat);
  }

  function onAmountChange(s: string) {
    setAmountRaw(s.replace(/\D/g, '').slice(0, 14));
  }

  const amount = amountRaw ? parseInt(amountRaw, 10) : 0;
  const amountDisplay = amount > 0 ? formatVND(amount) : '';

  async function submit() {
    if (!picked) {
      setError('Vui lòng chọn danh mục');
      haptic.error();
      return;
    }
    if (!amount) {
      setError('Vui lòng nhập số tiền ngân sách');
      haptic.error();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await budgetsApi.create({ category_id: Number(picked.id), amount });
      haptic.success();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Không tạo được ngân sách');
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
          <Text style={Typography.headingM}>Thêm ngân sách</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[Typography.labelL, { marginBottom: 10 }]}>Chọn danh mục</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <View style={styles.catList}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => pick(c)}
                  style={[
                    styles.catTile,
                    picked?.id === c.id && { backgroundColor: (c.color ?? Colors.primary) + '20', borderColor: c.color ?? Colors.primary },
                  ]}
                >
                  <View style={[styles.catIcon, { backgroundColor: (c.color ?? '#BDE83E') + '30' }]}>
                    <Ionicons name={(c.icon as any) ?? 'pricetag'} size={18} color={c.color ?? Colors.dark} />
                  </View>
                  <Text
                    style={[Typography.labelM, { flex: 1, marginLeft: 10 }]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {picked?.id === c.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={c.color ?? Colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 6 }]}>Số tiền ngân sách / tháng</Text>
          <View style={styles.balanceWrap}>
            <TextInput
              value={amountRaw}
              onChangeText={onAmountChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.grey400}
              style={[styles.input, { paddingRight: 80, flex: 1 }]}
            />
            <Text style={styles.balanceSuffix}>₫</Text>
          </View>
          {amountDisplay ? (
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>{amountDisplay}</Text>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.expense} />
              <Text style={[Typography.bodyS, { color: Colors.expense, marginLeft: 8, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Tạo ngân sách"
            onPress={submit}
            loading={submitting}
            disabled={loading}
            style={{ marginTop: Space.s24 }}
          />
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
  catList: { gap: 8 },
  catTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.s,
  },
  catIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  balanceWrap: { position: 'relative', justifyContent: 'center' },
  balanceSuffix: {
    position: 'absolute',
    right: 16,
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.s16,
    padding: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.expense + '15',
  },
});
