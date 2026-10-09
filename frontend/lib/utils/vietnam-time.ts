import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy đối tượng Dayjs hiện tại tại múi giờ Việt Nam (UTC+07:00)
 */
export function getVietnamNow(): dayjs.Dayjs {
  return dayjs().tz(VN_TIMEZONE);
}

/**
 * Chuyển đổi sang giờ Việt Nam
 */
export function toVietnamTime(date?: Date | string | number | null): dayjs.Dayjs {
  if (!date) return getVietnamNow();
  return dayjs(date).tz(VN_TIMEZONE);
}

/**
 * Định dạng ngày giờ theo chuẩn Việt Nam (Mặc định: DD/MM/YYYY HH:mm)
 */
export function formatVietnamDateTime(
  date?: Date | string | number | null,
  format = 'DD/MM/YYYY HH:mm',
): string {
  if (!date) return '';
  return dayjs(date).tz(VN_TIMEZONE).format(format);
}

/**
 * Định dạng ngày theo chuẩn Việt Nam (Mặc định: DD/MM/YYYY)
 */
export function formatVietnamDate(
  date?: Date | string | number | null,
  format = 'DD/MM/YYYY',
): string {
  if (!date) return '';
  return dayjs(date).tz(VN_TIMEZONE).format(format);
}

/**
 * Định dạng giờ theo chuẩn Việt Nam (Mặc định: HH:mm)
 */
export function formatVietnamTime(
  date?: Date | string | number | null,
  format = 'HH:mm',
): string {
  if (!date) return '';
  return dayjs(date).tz(VN_TIMEZONE).format(format);
}

/**
 * Định dạng số tiền VND (VD: 6.953.000 đ)
 */
export function formatVND(amount?: number | null): string {
  const val = Math.round(Number(amount || 0));
  return `${val.toLocaleString('vi-VN')} đ`;
}

/**
 * Định dạng số tiền VND không có ký hiệu đ (Dùng cho in nhiệt, VD: 6.953.000)
 */
export function formatVNDRaw(amount?: number | null): string {
  const val = Math.round(Number(amount || 0));
  return val.toLocaleString('vi-VN');
}

export type EndOfDayPreset =
  | 'CURRENT_SHIFT'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'CUSTOM';

export interface PresetRangeResult {
  from: string; // YYYY-MM-DDTHH:mm
  to: string;   // YYYY-MM-DDTHH:mm
  minAllowed: string; // 7 ngày trước (để giới hạn date picker)
  maxAllowed: string; // Hiện tại
}

/**
 * Sinh các mốc thời gian nhanh theo chuẩn giờ Việt Nam
 */
export function getPresetDateRange(
  preset: EndOfDayPreset,
  activeShiftOpenedAt?: Date | string | null,
): PresetRangeResult {
  const now = getVietnamNow();
  const minAllowed = now.subtract(7, 'day').startOf('day').format('YYYY-MM-DDTHH:mm');
  const maxAllowed = now.format('YYYY-MM-DDTHH:mm');

  switch (preset) {
    case 'CURRENT_SHIFT': {
      const fromShift = activeShiftOpenedAt
        ? dayjs(activeShiftOpenedAt).tz(VN_TIMEZONE).format('YYYY-MM-DDTHH:mm')
        : now.startOf('day').format('YYYY-MM-DDTHH:mm');
      return {
        from: fromShift,
        to: maxAllowed,
        minAllowed,
        maxAllowed,
      };
    }
    case 'TODAY':
      return {
        from: now.startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: maxAllowed,
        minAllowed,
        maxAllowed,
      };
    case 'YESTERDAY': {
      const yesterday = now.subtract(1, 'day');
      return {
        from: yesterday.startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: yesterday.endOf('day').format('YYYY-MM-DDTHH:mm'),
        minAllowed,
        maxAllowed,
      };
    }
    case 'LAST_7_DAYS':
      return {
        from: now.subtract(6, 'day').startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: maxAllowed,
        minAllowed,
        maxAllowed,
      };
    case 'CUSTOM':
    default:
      return {
        from: now.startOf('day').format('YYYY-MM-DDTHH:mm'),
        to: maxAllowed,
        minAllowed,
        maxAllowed,
      };
  }
}
