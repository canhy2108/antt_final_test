import { Account, Budget, Category, MonthStats, Transaction, User } from '@/types';

export const mockUser: User = {
  id: 'u-001',
  email: 'demo@budgetbee.app',
  name: 'Nguyễn Linh',
};

export const mockAccounts: Account[] = [
  { id: 'a-1', name: 'Vietcombank', type: 'Ngân hàng', balance: 12450000, currencySymbol: 'đ', color: '#22C55E' },
  { id: 'a-2', name: 'Tiền mặt', type: 'Ví',           balance: 850000,    currencySymbol: 'đ', color: '#F59E0B' },
  { id: 'a-3', name: 'Momo',        type: 'Ví điện tử', balance: 3200000,   currencySymbol: 'đ', color: '#A855F7' },
];

export const mockCategories: Category[] = [
  { id: 'c-1', name: 'Ăn uống',    icon: 'restaurant',           color: '#EF4444' },
  { id: 'c-2', name: 'Di chuyển',  icon: 'car',                  color: '#3B82F6' },
  { id: 'c-3', name: 'Mua sắm',    icon: 'cart',                 color: '#A855F7' },
  { id: 'c-4', name: 'Hoá đơn',    icon: 'receipt',              color: '#F59E0B' },
  { id: 'c-5', name: 'Giải trí',   icon: 'game-controller',      color: '#EC4899' },
  { id: 'c-6', name: 'Lương',      icon: 'wallet',               color: '#22C55E' },
];

const today = new Date();
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset);
  return d.toISOString();
};

export const mockTransactions: Transaction[] = [
  { id: 't-1', type: 'expense', amount: 85000,   date: day(0), name: 'Phở bò',           categoryId: 'c-1', categoryName: 'Ăn uống',    categoryColor: '#EF4444', accountId: 'a-2' },
  { id: 't-2', type: 'income',  amount: 15000000, date: day(0), name: 'Lương tháng 6',    categoryId: 'c-6', categoryName: 'Lương',      categoryColor: '#22C55E', accountId: 'a-1' },
  { id: 't-3', type: 'expense', amount: 230000,  date: day(1), name: 'Grab',             categoryId: 'c-2', categoryName: 'Di chuyển',  categoryColor: '#3B82F6', accountId: 'a-3' },
  { id: 't-4', type: 'expense', amount: 1200000, date: day(2), name: 'Áo khoác',         categoryId: 'c-3', categoryName: 'Mua sắm',    categoryColor: '#A855F7', accountId: 'a-1' },
  { id: 't-5', type: 'expense', amount: 450000,  date: day(3), name: 'Tiền điện',        categoryId: 'c-4', categoryName: 'Hoá đơn',    categoryColor: '#F59E0B', accountId: 'a-1' },
  { id: 't-6', type: 'expense', amount: 99000,   date: day(4), name: 'Netflix',          categoryId: 'c-5', categoryName: 'Giải trí',   categoryColor: '#EC4899', accountId: 'a-3' },
  { id: 't-7', type: 'expense', amount: 65000,   date: day(5), name: 'Cà phê',           categoryId: 'c-1', categoryName: 'Ăn uống',    categoryColor: '#EF4444', accountId: 'a-2' },
  { id: 't-8', type: 'expense', amount: 350000,  date: day(6), name: 'Đi siêu thị',       categoryId: 'c-3', categoryName: 'Mua sắm',    categoryColor: '#A855F7', accountId: 'a-1' },
];

export const mockBudgets: Budget[] = [
  { id: 'b-1', name: 'Ăn uống',    icon: 'restaurant',     color: '#EF4444', spent: 1800000,  limit: 3000000, period: 'month' },
  { id: 'b-2', name: 'Di chuyển',  icon: 'car',            color: '#3B82F6', spent: 750000,   limit: 1500000, period: 'month' },
  { id: 'b-3', name: 'Mua sắm',    icon: 'cart',           color: '#A855F7', spent: 2100000,  limit: 2000000, period: 'month' },
  { id: 'b-4', name: 'Giải trí',   icon: 'game-controller',color: '#EC4899', spent: 220000,   limit: 800000,  period: 'month' },
];

export const mockMonthStats: MonthStats = {
  income: 15000000,
  expense: 5079000,
  balance: 16500000,
};

export const mockBalanceTrend = [
  { value: 14000000, label: '01' },
  { value: 14800000, label: '05' },
  { value: 13500000, label: '10' },
  { value: 15200000, label: '15' },
  { value: 16100000, label: '20' },
  { value: 16500000, label: '25' },
  { value: 16500000, label: '30' },
];
