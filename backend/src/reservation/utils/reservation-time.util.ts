import * as crypto from 'crypto';

export const RESTAURANT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_UTC_OFFSET_HOURS = 7;

/**
 * Chuẩn hóa số điện thoại Việt Nam về định dạng thống nhất: 0xxxxxxxxx (10 chữ số)
 */
export function normalizePhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  // Loại bỏ khoảng trắng, dấu gạch, ngoặc, chấm
  let cleaned = rawPhone.replace(/[\s\-\.\(\)]/g, '').trim();

  // Chuyển +84 hoặc 84 về 0
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Phân tích ngày (YYYY-MM-DD) và giờ (HH:mm) theo giờ Việt Nam (+07:00) thành đối tượng Date UTC
 */
export function parseDateTimeVN(dateStr: string, timeStr: string): Date {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:mm"
  // Format theo ISO 8601 với timezone +07:00: "YYYY-MM-DDTHH:mm:00+07:00"
  const isoString = `${dateStr.trim()}T${timeStr.trim()}:00+07:00`;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Định dạng ngày giờ không hợp lệ: ${dateStr} ${timeStr}`);
  }
  return date;
}

/**
 * Format một UTC Date thành ngày (YYYY-MM-DD) theo timezone Việt Nam (+07:00)
 */
export function formatDateVN(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

/**
 * Format một UTC Date thành giờ (HH:mm) theo timezone Việt Nam (+07:00)
 */
export function formatTimeVN(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: RESTAURANT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date); // HH:mm
}

/**
 * Sinh mã đặt bàn duy nhất: AVR-YYMMDD-XXXX (VD: AVR-260904-89AB)
 */
export function generateReservationCode(date: Date = new Date()): string {
  const dateStr = formatDateVN(date).replace(/-/g, '').substring(2); // YYMMDD
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 ký tự hex
  return `AVR-${dateStr}-${randomSuffix}`;
}

/**
 * Sinh secure check-in token (không lộ UUID hoặc db secret)
 */
export function generateCheckInToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Kiểm tra giao thoa thời gian (Overlap) giữa 2 khoảng thời gian
 * Overlap xảy ra khi: StartA < EndB && EndA > StartB
 */
export function isTimeOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
  bufferMinutes: number = 0,
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  const effectiveEndA = new Date(endA.getTime() + bufferMs);
  const effectiveEndB = new Date(endB.getTime() + bufferMs);

  return startA < effectiveEndB && effectiveEndA > startB;
}

/**
 * Mask số điện thoại bảo vệ PII (VD: 0901234567 -> 090****567)
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const norm = normalizePhone(phone);
  if (norm.length < 7) return norm;
  return norm.substring(0, 3) + '****' + norm.substring(norm.length - 3);
}
