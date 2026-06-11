/**
 * Preset list of common Vietnamese banks + e-wallets for the
 * Add Account picker. The `defaultTypeName` matches the seeded
 * AccountTypes on backend ("Checking account", "Cash", "Savings",
 * "Credit card", "General"). The Add Account screen resolves
 * that name → type_id via accountsApi.getTypes().
 */
export interface VnBank {
  id: string;
  shortName: string;
  fullName: string;
  /** Brand hex used as the account color + picker tile background. */
  color: string;
  category: 'bank' | 'wallet' | 'cash' | 'card' | 'savings' | 'other';
  defaultTypeName: 'Checking account' | 'Cash' | 'Savings' | 'Credit card' | 'General';
}

export const VN_BANKS: VnBank[] = [
  { id: 'vcb', shortName: 'VCB', fullName: 'Vietcombank', color: '#0DA046', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'bidv', shortName: 'BIDV', fullName: 'BIDV', color: '#005CAA', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'ctg', shortName: 'CTG', fullName: 'VietinBank', color: '#0066B3', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'agb', shortName: 'AGB', fullName: 'Agribank', color: '#A02828', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'mb', shortName: 'MB', fullName: 'MB Bank', color: '#0072BC', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'tcb', shortName: 'TCB', fullName: 'Techcombank', color: '#E30613', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'vpb', shortName: 'VPB', fullName: 'VPBank', color: '#00A859', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'acb', shortName: 'ACB', fullName: 'ACB', color: '#005CA9', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'stb', shortName: 'STB', fullName: 'Sacombank', color: '#005EAB', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'tpb', shortName: 'TPB', fullName: 'TPBank', color: '#6F378A', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'vib', shortName: 'VIB', fullName: 'VIB', color: '#0058A0', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'hdb', shortName: 'HDB', fullName: 'HDBank', color: '#E60019', category: 'bank', defaultTypeName: 'Checking account' },
  { id: 'momo', shortName: 'M', fullName: 'MoMo', color: '#A50064', category: 'wallet', defaultTypeName: 'Checking account' },
  { id: 'zalopay', shortName: 'Z', fullName: 'ZaloPay', color: '#0068FF', category: 'wallet', defaultTypeName: 'Checking account' },
  { id: 'shopeepay', shortName: 'SPP', fullName: 'ShopeePay', color: '#EE4D2D', category: 'wallet', defaultTypeName: 'Checking account' },
  { id: 'cash', shortName: '💵', fullName: 'Tiền mặt', color: '#16A34A', category: 'cash', defaultTypeName: 'Cash' },
  { id: 'savings', shortName: '💰', fullName: 'Tiết kiệm', color: '#F59E0B', category: 'savings', defaultTypeName: 'Savings' },
  { id: 'credit', shortName: '💳', fullName: 'Thẻ tín dụng', color: '#7C3AED', category: 'card', defaultTypeName: 'Credit card' },
  { id: 'other', shortName: '🏦', fullName: 'Khác', color: '#71717A', category: 'other', defaultTypeName: 'General' },
];
