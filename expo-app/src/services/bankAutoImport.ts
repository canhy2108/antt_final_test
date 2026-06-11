/**
 * Bank auto-import orchestrator.
 *
 * Lắng nghe notification của các bank app → parser bóc số tiền + mô tả
 * → tự động tạo record trên backend. Có 2 chế độ:
 *
 *   - `auto`     : confidence ≥ 0.85 → POST /record ngay, push notification
 *                  trong BudgetBee để user biết.
 *   - `confirm`  : Bất kỳ confidence → đẩy vào hàng đợi review;
 *                  user phải xác nhận trong tab Thông báo trước khi lưu.
 *
 * User chọn chế độ trong Settings. Mặc định "confirm" để chống false-positive
 * (đặc biệt với ngân hàng có template SMS lạ).
 */

import { transactionsApi } from '@/api/transactions';
import { accountsApi } from '@/api/accounts';
import { categoriesApi } from '@/api/categories';
import { Account } from '@/types';
import { notificationListener, BankNotificationEvent } from './notificationListener';
import { ParsedBankNotification, CategoryKey } from './bankNotificationParser';
import { secureStorage } from './secureStorage';

const STORAGE_MODE_KEY = 'bank_auto_import_mode';
const STORAGE_PENDING_KEY = 'bank_auto_import_pending';

export type AutoImportMode = 'off' | 'auto' | 'confirm';

export interface PendingImport {
  /** UUID local để dedupe nếu cùng notification đến 2 lần. */
  id: string;
  parsed: ParsedBankNotification;
  event: BankNotificationEvent;
  /** Account id đoán được (nếu accountLast4 khớp với 1 account của user). */
  guessedAccountId: string | null;
  /** Category id đoán được. */
  guessedCategoryId: number | null;
  /** Trạng thái: chờ user xác nhận. */
  status: 'pending';
}

let unsubscribe: (() => void) | null = null;
let accountsCache: Account[] = [];
let categoryIdByKey: Record<string, number> = {};
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function refreshLookupsIfStale(): Promise<void> {
  if (Date.now() - cacheLoadedAt < CACHE_TTL_MS && accountsCache.length > 0) return;
  try {
    const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
    accountsCache = accs;
    categoryIdByKey = mapCategoriesToKeys(cats);
    cacheLoadedAt = Date.now();
  } catch {
    // Không fail vì auto-import là best-effort. Lần notification sau sẽ retry.
  }
}

function mapCategoriesToKeys(cats: Array<{ id: string | number; name: string }>): Record<string, number> {
  // Heuristic mapping: match name của category với CategoryKey.
  const map: Record<string, number> = {};
  for (const c of cats) {
    const lower = c.name.toLowerCase();
    if (/food|ăn|coffee|cafe/i.test(lower)) map.food = Number(c.id);
    else if (/shop|mua sắm|shopping/i.test(lower)) map.shopping = Number(c.id);
    else if (/transport|di chuyển|xăng|grab|taxi/i.test(lower)) map.transport = Number(c.id);
    else if (/salary|lương|thu nhập/i.test(lower)) map.salary = Number(c.id);
    else if (/transfer|chuyển khoản/i.test(lower)) map.transfer = Number(c.id);
    else if (/utility|hoá đơn|điện|nước/i.test(lower)) map.utility = Number(c.id);
    else if (/entertainment|giải trí/i.test(lower)) map.entertainment = Number(c.id);
    else if (/health|sức khoẻ|y tế/i.test(lower)) map.health = Number(c.id);
    else if (/education|giáo dục|học/i.test(lower)) map.education = Number(c.id);
  }
  return map;
}

function findAccountByLast4(last4: string | null): Account | null {
  if (!last4) return null;
  return accountsCache.find((a) => a.name.includes(last4)) ?? null;
}

function categoryIdFor(key: CategoryKey | null): number | null {
  if (!key) return null;
  return categoryIdByKey[key] ?? null;
}

async function persistPending(item: PendingImport): Promise<void> {
  const existing = await loadPending();
  const dedupKey = `${item.parsed.bankId}:${item.parsed.amount}:${item.event.timestamp}`;
  if (existing.some((e) => `${e.parsed.bankId}:${e.parsed.amount}:${e.event.timestamp}` === dedupKey)) return;
  const next = [item, ...existing].slice(0, 50); // giữ tối đa 50 pending
  await secureStorage.writeRawPinHash; // no-op import guard
  // Tận dụng SecureStore qua AsyncStorage-like helper trong secureStorage —
  // nhưng pending list không nhạy cảm → AsyncStorage là đủ.
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(next));
}

export async function loadPending(): Promise<PendingImport[]> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await AsyncStorage.getItem(STORAGE_PENDING_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingImport[];
  } catch {
    return [];
  }
}

export async function removePending(id: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const list = await loadPending();
  await AsyncStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(list.filter((p) => p.id !== id)));
}

export async function getMode(): Promise<AutoImportMode> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const v = await AsyncStorage.getItem(STORAGE_MODE_KEY);
  if (v === 'auto' || v === 'confirm' || v === 'off') return v;
  return 'off';
}

export async function setMode(mode: AutoImportMode): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(STORAGE_MODE_KEY, mode);
  // Re-subscribe / unsubscribe theo mode.
  if (mode === 'off') {
    unsubscribe?.();
    unsubscribe = null;
  } else if (!unsubscribe) {
    startListening();
  }
}

/**
 * Tự động tạo record trên backend từ một parsed notification + account
 * đoán được. Caller phải đảm bảo account != null trước khi gọi (vì
 * backend yêu cầu from_account_id).
 */
async function createTransaction(parsed: ParsedBankNotification, account: Account, categoryId: number | null): Promise<void> {
  await transactionsApi.create({
    type: parsed.direction,
    amount: parsed.amount,
    date: new Date().toISOString().slice(0, 10),
    name: parsed.description || `${parsed.bankName} auto`,
    category_id: categoryId ?? undefined,
    from_account_id: Number(account.id),
  } as any);
}

/**
 * Bắt đầu lắng nghe. Idempotent — gọi 2 lần không tăng số listener.
 */
export function startListening(): void {
  if (unsubscribe) return;
  if (!notificationListener.isAvailable()) {
    // eslint-disable-next-line no-console
    console.warn('[bankAutoImport] notification listener không khả dụng, bỏ qua');
    return;
  }
  unsubscribe = notificationListener.subscribe(async (event, parsed) => {
    if (!parsed) return;
    const mode = await getMode();
    if (mode === 'off') return;

    await refreshLookupsIfStale();
    const account = findAccountByLast4(parsed.accountLast4);
    const categoryId = categoryIdFor(parsed.guessedCategoryKey);

    const pendingItem: PendingImport = {
      id: `${parsed.bankId}-${parsed.amount}-${event.timestamp}`,
      parsed,
      event,
      guessedAccountId: account?.id ?? null,
      guessedCategoryId: categoryId,
      status: 'pending',
    };

    if (mode === 'auto' && account && parsed.confidence >= 0.85) {
      try {
        await createTransaction(parsed, account, categoryId);
        // Không persist vào pending vì đã tạo xong.
        return;
      } catch {
        // Fall through → để vào pending cho user retry.
      }
    }
    await persistPending(pendingItem);
  });
}

export function stopListening(): void {
  unsubscribe?.();
  unsubscribe = null;
}

/** Một-shot helper để FE phê duyệt 1 pending item thành record thật. */
export async function approvePending(id: string, overrides?: { accountId?: string; categoryId?: number }): Promise<void> {
  const list = await loadPending();
  const item = list.find((p) => p.id === id);
  if (!item) return;
  await refreshLookupsIfStale();
  const account =
    overrides?.accountId
      ? accountsCache.find((a) => a.id === overrides.accountId) ?? null
      : item.guessedAccountId
      ? accountsCache.find((a) => a.id === item.guessedAccountId) ?? null
      : null;
  if (!account) {
    throw new Error('Cần chọn tài khoản trước khi lưu giao dịch.');
  }
  const categoryId = overrides?.categoryId ?? item.guessedCategoryId;
  await createTransaction(item.parsed, account, categoryId);
  await removePending(id);
}
