export function formatVND(value: number, symbol = 'đ'): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.round(value));
  const text = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${text} ${symbol}`;
}

export function formatCompactVND(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + ' tỷ';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + ' tr';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' k';
  return value.toString();
}

const VI_MONTHS = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];
const VI_DAYS = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${String(date.getDate()).padStart(2, '0')} ${VI_MONTHS[date.getMonth()]}`;
}

export function formatFullDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${VI_DAYS[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  const x = typeof a === 'string' ? new Date(a) : a;
  const y = typeof b === 'string' ? new Date(b) : b;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function relativeDateLabel(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return 'Hôm nay';
  if (isSameDay(date, y)) return 'Hôm qua';
  return formatFullDate(date);
}
