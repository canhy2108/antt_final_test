/**
 * Bank notification parser — pure JS, không phụ thuộc native module nên
 * test được bằng Jest và chạy được trên cả Android / iOS (mặc dù trên
 * iOS hiện không có cách lấy raw notification của app khác, xem
 * `notificationListener.ts` để hiểu giới hạn).
 *
 * Triết lý:
 *   - Mỗi ngân hàng có 1 quy tắc regex riêng (số tiền, dấu ±, balance,
 *     mô tả). Chúng tôi cố pattern bank-cụ-thể trước, fallback về parser
 *     "generic VN" dựa trên các từ khoá phổ biến: "GD:", "Số dư:",
 *     "+10,000 VND", "TK:".
 *   - KHÔNG suy đoán nếu pattern không khớp — trả về null. Auto-create
 *     transaction mà sai số tiền/sai dấu thì user mất niềm tin rất nhanh.
 *   - Trả về `confidence` (0..1) để UI có thể quyết định: cao thì
 *     tự lưu, thấp thì hiện banner "Bạn vừa nhận thông báo X, lưu?".
 *
 * Test data thực tế của các bank VN (đã ẩn số TK):
 *   Vietcombank: "TK 0011****1234 +5,000,000 VND ngay 12/06/2026
 *                 ND: NGUYEN VAN A chuyen khoan So du: 7,250,000 VND"
 *   Techcombank: "TK *4567 GD: -120,000VND luc 14:30 11/06
 *                 Noi dung: STARBUCKS LANDMARK So du: 3,580,000"
 *   MB Bank:     "Bien dong so du TK *8888: -45,000 VND luc 18:22
 *                 11/06 Noi dung: GRAB OI*XEM SD: 2,105,000 VND"
 *   ACB:         "+200,000 VND vao TK *9999 luc 09:15 ND: LUONG 06/2026
 *                 So du: 8,500,000 VND"
 */

export type TransactionDirection = 'income' | 'expense';

export interface ParsedBankNotification {
  /** "+" → income, "-" → expense. Suy ra từ dấu trong text. */
  direction: TransactionDirection;
  /** Số tiền tuyệt đối, đã chuẩn hóa về number (VND, không có dấu phẩy). */
  amount: number;
  /** Số dư còn lại sau giao dịch, nếu parser bóc được. null nếu không. */
  balanceAfter: number | null;
  /** Mô tả thô (Noi dung / ND / GD). Dùng để gợi ý category. */
  description: string;
  /** Mã tài khoản 4 số cuối (ví dụ "*1234"), nếu có. Match với account user. */
  accountLast4: string | null;
  /** id ngân hàng từ VN_BANKS — viết tắt: vcb, tcb, mb, acb... */
  bankId: string;
  /** Tên hiển thị (Vietcombank, Techcombank...). */
  bankName: string;
  /** 0..1. 1 = pattern bank-specific khớp; 0.6 = generic fallback khớp. */
  confidence: number;
  /** Category đoán được từ keyword (food / shopping / salary / transfer...). */
  guessedCategoryKey: CategoryKey | null;
  /** Text gốc — luôn giữ lại để debug / hiển thị raw cho user. */
  rawText: string;
}

export type CategoryKey =
  | 'food'
  | 'shopping'
  | 'transport'
  | 'salary'
  | 'transfer'
  | 'utility'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'other';

/* ---------------------------------------------------------- HELPERS -- */

/** "5,000,000" / "5.000.000" / "5000000" → 5000000. */
function normalizeAmount(s: string): number {
  return parseInt(s.replace(/[.,\s]/g, ''), 10);
}

/**
 * Bóc tất cả các "khối số tiền" trong text. Trả về 2 phần tử lớn nhất
 * theo thứ tự xuất hiện, vì cấu trúc SMS bank VN thường là
 *   [số tiền giao dịch] ... [số dư]
 */
function extractMoneyTokens(text: string): { value: number; raw: string; index: number }[] {
  // Match số có ít nhất 3 chữ số (loại trừ giờ 14:30) + optional dấu , hoặc .
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d{4,12})\s*(?:VND|VNĐ|đ|d)?/gi;
  const out: { value: number; raw: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = normalizeAmount(m[1]);
    if (Number.isFinite(v) && v >= 1000) {
      // Loại nhiễu nhỏ (mã OTP 6 số ~ 100k–999k thật, nhưng cũng giữ).
      out.push({ value: v, raw: m[1], index: m.index });
    }
  }
  return out;
}

/** Trả về '+' / '-' / null tuỳ context gần với token tiền. */
function detectSign(text: string, moneyIndex: number): '+' | '-' | null {
  // Xét ô cửa sổ ±20 ký tự quanh vị trí token tiền.
  const window = text.slice(Math.max(0, moneyIndex - 20), moneyIndex + 25);
  if (/[+]\s*\d|cộng|nhận được|ghi có|thu|vào TK|chuyển đến|đã nhận/i.test(window)) return '+';
  if (/[-]\s*\d|trừ|đã trả|ghi nợ|chi|rút|thanh toán|chuyển khoản|chuyển đi/i.test(window)) return '-';
  return null;
}

/** "TK 0011****1234" / "TK *1234" / "TK xxxx1234" → "1234". */
function extractAccountLast4(text: string): string | null {
  const m = text.match(/(?:TK|tài khoản|account)[^\d]{0,8}([\d*x]{4,20})(\d{4})/i)
        ?? text.match(/\*+\s*(\d{4})/);
  if (!m) return null;
  return m[m.length - 1].slice(-4);
}

/** Bóc số dư sau giao dịch. */
function extractBalanceAfter(text: string, moneyTokens: { value: number; index: number }[]): number | null {
  // Pattern phổ biến: "So du: <số>" / "SD: <số>" / "Số dư: <số>"
  const m = text.match(/(?:s[ốo]\s*d[ưu]|sd|balance)[:\s]+([\d.,]+)/i);
  if (m) return normalizeAmount(m[1]);

  // Fallback: nếu có >= 2 money tokens, token cuối cùng thường là balance.
  if (moneyTokens.length >= 2) return moneyTokens[moneyTokens.length - 1].value;
  return null;
}

/** Bóc mô tả: dải text sau "ND:" / "Noi dung:" / "GD:" tới hết câu. */
function extractDescription(text: string): string {
  const m = text.match(/(?:n[ộo]i\s*dung|nd|gd|content|memo)[:\s]+([^\n.]+?)(?:\s+s[ốo]\s*d[ưu]|\.|$)/i);
  return m ? m[1].trim() : '';
}

/* ----------------------------------------------------- BANK PATTERNS -- */

interface BankRule {
  id: string;
  name: string;
  /** Package name của app ngân hàng trên Android (để filter). */
  androidPackage?: string;
  /** Các từ khoá đặc trưng để nhận diện text khi không có packageName. */
  textFingerprints: RegExp[];
}

/**
 * Danh sách rule cho các ngân hàng VN phổ biến. `androidPackage` giúp
 * dispatch chính xác khi NotificationListener gửi event lên.
 */
export const BANK_RULES: BankRule[] = [
  {
    id: 'vcb',
    name: 'Vietcombank',
    androidPackage: 'com.VCB',
    textFingerprints: [/vietcombank/i, /\bVCB\b/, /TK\s*\d+\*+\d+/],
  },
  {
    id: 'tcb',
    name: 'Techcombank',
    androidPackage: 'vn.com.techcombank.bb.app',
    textFingerprints: [/techcombank/i, /\bTCB\b/, /F@ST\s?Mobile/i],
  },
  {
    id: 'mb',
    name: 'MB Bank',
    androidPackage: 'com.mbmobile',
    textFingerprints: [/MB\s*Bank/i, /MBBank/i, /MBApp/i],
  },
  {
    id: 'acb',
    name: 'ACB',
    androidPackage: 'mobile.acb.com.vn',
    textFingerprints: [/\bACB\b/, /ACB\s?ONE/i],
  },
  {
    id: 'bidv',
    name: 'BIDV',
    androidPackage: 'com.vnpay.bidv',
    textFingerprints: [/\bBIDV\b/i, /SmartBanking/i],
  },
  {
    id: 'ctg',
    name: 'VietinBank',
    androidPackage: 'com.vietinbank.ipay',
    textFingerprints: [/vietinbank/i, /\biPay\b/i],
  },
  {
    id: 'vpb',
    name: 'VPBank',
    androidPackage: 'com.vpb.mobilebanking.android',
    textFingerprints: [/vpbank/i, /\bVPB\b/i, /NEO/],
  },
  {
    id: 'tpb',
    name: 'TPBank',
    androidPackage: 'com.tpb.mb.gprsandroid',
    textFingerprints: [/tpbank/i, /\bTPB\b/i],
  },
  {
    id: 'stb',
    name: 'Sacombank',
    androidPackage: 'src.com.sacombank',
    textFingerprints: [/sacombank/i, /\bSTB\b/i],
  },
  {
    id: 'agb',
    name: 'Agribank',
    androidPackage: 'com.vnpay.Agribank',
    textFingerprints: [/agribank/i, /\bAGB\b/i],
  },
  // E-wallets — đối xử như "bank" vì notification của Momo / ZaloPay cũng
  // chứa số tiền và mô tả giao dịch tương tự.
  {
    id: 'momo',
    name: 'MoMo',
    androidPackage: 'com.mservice.momotransfer',
    textFingerprints: [/momo/i, /Ví\s?MoMo/i],
  },
  {
    id: 'zalopay',
    name: 'ZaloPay',
    androidPackage: 'vn.com.vng.zalopay',
    textFingerprints: [/zalopay/i],
  },
];

/* ---------------------------------------------------- CATEGORY GUESS -- */

interface CategoryKeyword {
  key: CategoryKey;
  /** Regex áp dụng vào description (đã lowercased). */
  pattern: RegExp;
}

/**
 * Bảng từ khoá. Đặt category cụ thể TRƯỚC category chung — match đầu
 * tiên thắng. KHÔNG dùng `g` flag (làm hỏng lastIndex giữa các lần test).
 */
const CATEGORY_KEYWORDS: CategoryKeyword[] = [
  // Lương / income đặc biệt
  { key: 'salary',        pattern: /\b(luong|salary|payroll|thu nhap|lương)\b/i },
  // Ăn uống
  { key: 'food',          pattern: /(grab\s?food|shopeefood|baemin|the coffee|highlands|starbucks|phuc long|cafe|coffee|com tam|pho|bun|nha hang|quan an|nhà hàng|ăn uống)/i },
  // Vận chuyển
  { key: 'transport',     pattern: /(grab|be\s|gojek|xanh sm|taxi|xe om|xăng|petrol|gas station|petrolimex|esso|shell)/i },
  // Mua sắm
  { key: 'shopping',      pattern: /(shopee|lazada|tiki|sendo|mall|store|big c|coopmart|vinmart|winmart|mua hàng|đặt hàng)/i },
  // Tiện ích / hoá đơn
  { key: 'utility',       pattern: /(evn|điện|nước|water bill|internet|fpt|viettel|vinaphone|mobifone|wifi|truyền hình|cáp)/i },
  // Giải trí
  { key: 'entertainment', pattern: /(netflix|spotify|youtube|cgv|lotte cinema|galaxy cinema|cinestar|game|steam|appstore)/i },
  // Sức khoẻ
  { key: 'health',        pattern: /(pharmacity|long chau|nha thuoc|benh vien|phong kham|hospital|clinic|pharmacy)/i },
  // Giáo dục
  { key: 'education',     pattern: /(coursera|udemy|edx|elsa|monkey|hoc phi|truong|kindergarten|school)/i },
  // Chuyển khoản nội bộ giữa các tài khoản của user (heuristic)
  { key: 'transfer',      pattern: /(chuyen tien|transfer|chuyen khoan|ck noi bo|den ngoai|ngoai he thong|ngoài hệ thống)/i },
];

function guessCategory(description: string): CategoryKey | null {
  const text = description.toLowerCase();
  for (const { key, pattern } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

/* ---------------------------------------------------------- IDENTIFY -- */

function identifyBank(opts: { text: string; androidPackage?: string }): BankRule | null {
  if (opts.androidPackage) {
    const byPkg = BANK_RULES.find((r) => r.androidPackage === opts.androidPackage);
    if (byPkg) return byPkg;
  }
  for (const r of BANK_RULES) {
    if (r.textFingerprints.some((p) => p.test(opts.text))) return r;
  }
  return null;
}

/* ----------------------------------------------------------- PARSER -- */

/**
 * Cố parse 1 thông báo. Trả về null nếu không đủ tin cậy. Caller (UI /
 * service) quyết định có lưu hay không dựa trên `confidence`.
 *
 * @param rawText  Toàn bộ text của notification (title + body ghép lại).
 * @param opts.androidPackage  packageName của app gửi (chỉ Android có).
 */
export function parseBankNotification(
  rawText: string,
  opts: { androidPackage?: string } = {},
): ParsedBankNotification | null {
  const text = (rawText ?? '').trim();
  if (text.length < 10) return null;

  const bank = identifyBank({ text, androidPackage: opts.androidPackage });
  if (!bank) return null;

  const moneyTokens = extractMoneyTokens(text);
  if (moneyTokens.length === 0) return null;

  // Heuristic: token đầu tiên = số tiền giao dịch (luôn xuất hiện trước balance).
  const txToken = moneyTokens[0];

  const sign = detectSign(text, txToken.index);
  if (sign === null) {
    // Không xác định được dấu → trả về null thay vì đoán. An toàn hơn cho UX.
    return null;
  }

  const description = extractDescription(text);
  const balanceAfter = extractBalanceAfter(text, moneyTokens);
  const accountLast4 = extractAccountLast4(text);

  // Confidence:
  //   1.00 = nhận diện bank qua packageName VÀ có description VÀ có balance
  //   0.85 = thiếu 1 trong 2 (description / balance)
  //   0.60 = nhận diện bank qua text fingerprint (không có packageName)
  let confidence = opts.androidPackage ? 0.85 : 0.6;
  if (description && balanceAfter !== null && opts.androidPackage) confidence = 1;

  return {
    direction: sign === '+' ? 'income' : 'expense',
    amount: txToken.value,
    balanceAfter,
    description,
    accountLast4,
    bankId: bank.id,
    bankName: bank.name,
    confidence,
    guessedCategoryKey: guessCategory(description || text),
    rawText: text,
  };
}
