export type TransactionType = 'expense' | 'income' | 'transfer';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currencySymbol: string;
  color: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  name: string;
  note?: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  accountId: string;
}

export interface Budget {
  id: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  period: 'month' | 'week';
}

export interface MonthStats {
  income: number;
  expense: number;
  balance: number;
}

export type BiometricCapability = 'biometric' | 'deviceCredential' | 'unavailable';
export type BiometricResult =
  | 'success'
  | 'failed'
  | 'notAvailable'
  | 'notEnrolled'
  | 'lockedOut'
  | 'error';
