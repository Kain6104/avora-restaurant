/**
 * AVORA FARM - VIETNAM TIMEZONE UTILITIES (Asia/Ho_Chi_Minh - UTC+07:00)
 * Đảm bảo toàn bộ hệ thống Daily Mission, Daily Limits, Reset ngày mới
 * hoạt động chuẩn xác 100% theo giờ Việt Nam bất kể máy chủ VPS chạy múi giờ nào (UTC, etc.)
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_UTC_OFFSET_HOURS = 7;
export const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Trả về chuỗi DateKey chuẩn YYYY-MM-DD theo giờ Việt Nam (Asia/Ho_Chi_Minh)
 * Ví dụ: "2026-09-14"
 */
export function getVietnamDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Luôn trả về định dạng YYYY-MM-DD
}

/**
 * Lấy mốc thời gian bắt đầu ngày (00:00:00.000) theo giờ Việt Nam dạng UTC Date
 */
export function getVietnamStartOfDay(date: Date = new Date()): Date {
  const dateKey = getVietnamDateKey(date);
  return new Date(`${dateKey}T00:00:00.000+07:00`);
}

/**
 * Lấy mốc thời gian kết thúc ngày (23:59:59.999) theo giờ Việt Nam dạng UTC Date
 */
export function getVietnamEndOfDay(date: Date = new Date()): Date {
  const dateKey = getVietnamDateKey(date);
  return new Date(`${dateKey}T23:59:59.999+07:00`);
}

/**
 * Lấy thời điểm 00:00:00 ngày tiếp theo theo giờ Việt Nam (Next Daily Reset)
 */
export function getVietnamNextReset(date: Date = new Date()): Date {
  const startOfToday = getVietnamStartOfDay(date);
  return new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Số giây còn lại tính đến 00:00:00 ngày tiếp theo theo giờ Việt Nam
 */
export function getVietnamSecondsUntilNextReset(date: Date = new Date()): number {
  const nextReset = getVietnamNextReset(date);
  return Math.max(0, Math.floor((nextReset.getTime() - Date.now()) / 1000));
}

/**
 * Kiểm tra 2 mốc thời gian có cùng ngày theo giờ Việt Nam không
 */
export function isSameVietnamDay(date1: Date, date2: Date): boolean {
  return getVietnamDateKey(date1) === getVietnamDateKey(date2);
}
