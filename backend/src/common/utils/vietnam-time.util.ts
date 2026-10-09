import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BadRequestException } from '@nestjs/common';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lấy đối tượng Dayjs đại diện cho thời điểm hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVietnamNow(): dayjs.Dayjs {
  return dayjs().tz(VN_TIMEZONE);
}

/**
 * Chuyển đổi bất kỳ mốc thời gian (Date, string, number) sang đối tượng Dayjs tại múi giờ Việt Nam
 */
export function toVietnamTime(date?: Date | string | number | null): dayjs.Dayjs {
  if (!date) return getVietnamNow();
  return dayjs(date).tz(VN_TIMEZONE);
}

/**
 * Định dạng ngày theo định dạng Việt Nam (Mặc định: DD/MM/YYYY)
 */
export function formatVietnamDate(
  date: Date | string | number | null | undefined,
  format = 'DD/MM/YYYY',
): string {
  if (!date) return '';
  return dayjs(date).tz(VN_TIMEZONE).format(format);
}

/**
 * Định dạng ngày & giờ theo chuẩn Việt Nam (Mặc định: DD/MM/YYYY HH:mm)
 */
export function formatVietnamDateTime(
  date: Date | string | number | null | undefined,
  format = 'DD/MM/YYYY HH:mm',
): string {
  if (!date) return '';
  return dayjs(date).tz(VN_TIMEZONE).format(format);
}

export function getVietnamHour(date: Date | string | number | null | undefined): number {
  if (!date) return getVietnamNow().hour();
  return dayjs(date).tz(VN_TIMEZONE).hour();
}

/**
 * Lấy chuỗi ngày định dạng YYYY-MM-DD theo giờ Việt Nam
 * Đảm bảo gom nhóm biểu đồ / báo cáo theo ngày lịch Việt Nam, không dùng toISOString().slice(0, 10)
 */
export function getVietnamDateString(date?: Date | string | number | null): string {
  if (!date) return getVietnamNow().format('YYYY-MM-DD');
  return dayjs(date).tz(VN_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Chuyển đổi một ngày nghiệp vụ YYYY-MM-DD (Việt Nam) thành khoảng UTC chính xác cho Prisma query
 * 00:00:00.000 Asia/Ho_Chi_Minh -> 23:59:59.999 Asia/Ho_Chi_Minh
 */
export function getVietnamBusinessDayBounds(dateStr: string): { startUtc: Date; endUtc: Date } {
  const startDayjs = dayjs.tz(`${dateStr} 00:00:00.000`, VN_TIMEZONE);
  const endDayjs = dayjs.tz(`${dateStr} 23:59:59.999`, VN_TIMEZONE);

  if (!startDayjs.isValid() || !endDayjs.isValid()) {
    throw new BadRequestException(`Định dạng ngày không hợp lệ: ${dateStr}`);
  }

  return {
    startUtc: startDayjs.toDate(),
    endUtc: endDayjs.toDate(),
  };
}

export interface ParsedVietnamDateRange {
  startUtc: Date;
  endUtc: Date;
  startVnStr: string; // VD: "13/09/2026 00:00"
  endVnStr: string;   // VD: "13/09/2026 23:59"
  fromDateVn: string; // "2026-09-13"
  toDateVn: string;   // "2026-09-13"
}

/**
 * Phân tích và chuẩn hóa khoảng thời gian đầu vào theo chuẩn giờ Việt Nam (Asia/Ho_Chi_Minh)
 * Hỗ trợ:
 * - YYYY-MM-DD kèm fromHour / toHour
 * - ISO String có giờ phút (VD: 2026-09-13T08:30)
 * - Mặc định khi không truyền: 00:00 hôm nay đến thời điểm hiện tại
 */
export function parseVietnamDateRange(
  from?: string,
  to?: string,
  fromHour?: string | number,
  toHour?: string | number,
): ParsedVietnamDateRange {
  const now = getVietnamNow();

  let startDayjs: dayjs.Dayjs;
  let endDayjs: dayjs.Dayjs;

  if (from && to) {
    // Kiểm tra xem chuỗi có chứa giờ phút hay không (VD: T14:30 hoặc khoảng trắng 14:30)
    const hasFromTime = from.includes('T') || from.includes(' ');
    const hasToTime = to.includes('T') || to.includes(' ');

    if (hasFromTime) {
      // Chuỗi đã có giờ: parse trực tiếp tại múi giờ VN
      const normalizedFrom = from.replace(' ', 'T');
      startDayjs = dayjs.tz(normalizedFrom, VN_TIMEZONE);
    } else if (fromHour !== undefined && fromHour !== null && fromHour !== '') {
      const h = String(fromHour).padStart(2, '0');
      startDayjs = dayjs.tz(`${from} ${h}:00:00.000`, VN_TIMEZONE);
    } else {
      startDayjs = dayjs.tz(`${from} 00:00:00.000`, VN_TIMEZONE);
    }

    if (hasToTime) {
      const normalizedTo = to.replace(' ', 'T');
      endDayjs = dayjs.tz(normalizedTo, VN_TIMEZONE);
    } else if (toHour !== undefined && toHour !== null && toHour !== '') {
      const h = String(toHour).padStart(2, '0');
      endDayjs = dayjs.tz(`${to} ${h}:59:59.999`, VN_TIMEZONE);
    } else {
      const endOfDay = dayjs.tz(`${to} 23:59:59.999`, VN_TIMEZONE);
      // Nếu ngày kết thúc là hôm nay, tự động chốt đến thời điểm hiện tại (now)
      endDayjs = endOfDay.isAfter(now) && dayjs.tz(`${to} 00:00:00.000`, VN_TIMEZONE).isBefore(now)
        ? now
        : endOfDay;
    }
  } else {
    // Mặc định: Từ đầu ngày hôm nay (00:00:00) đến hiện tại
    startDayjs = now.startOf('day');
    endDayjs = now;
  }

  if (!startDayjs.isValid() || !endDayjs.isValid()) {
    throw new BadRequestException('Khoảng ngày giờ cung cấp không hợp lệ.');
  }

  if (startDayjs.isAfter(endDayjs)) {
    throw new BadRequestException('Thời gian bắt đầu không được lớn hơn thời gian kết thúc.');
  }

  return {
    startUtc: startDayjs.toDate(),
    endUtc: endDayjs.toDate(),
    startVnStr: startDayjs.format('DD/MM/YYYY HH:mm'),
    endVnStr: endDayjs.format('DD/MM/YYYY HH:mm'),
    fromDateVn: startDayjs.format('YYYY-MM-DD'),
    toDateVn: endDayjs.format('YYYY-MM-DD'),
  };
}

/**
 * Kiểm tra nghiêm ngặt quy tắc 7 ngày gần nhất (Backend Source-of-Truth Enforcement)
 * Quy tắc:
 * 1. Không được chọn thời gian trong tương lai (cho phép dung sai 5 phút chống lệch đồng hồ)
 * 2. Không được lấy dữ liệu cũ hơn 7 ngày tính theo giờ Việt Nam
 * 3. Khoảng truy vấn tối đa không vượt quá 7 ngày
 */
export function validateSevenDaysRule(startUtc: Date, endUtc: Date): void {
  const now = getVietnamNow();
  
  // Dung sai tối đa 5 phút trong tương lai
  const maxFutureAllowed = now.add(5, 'minute').toDate();
  if (endUtc.getTime() > maxFutureAllowed.getTime()) {
    throw new BadRequestException('Không được chọn thời gian trong tương lai.');
  }

  // Mốc cũ nhất: 7 ngày trước tính từ 00:00:00 của ngày cách đây 7 ngày theo giờ VN
  const oldestAllowed = now.subtract(7, 'day').startOf('day').toDate();
  if (startUtc.getTime() < oldestAllowed.getTime()) {
    throw new BadRequestException('Chỉ được xem và in dữ liệu trong 7 ngày gần nhất.');
  }

  // Khoảng cách tối đa giữa from và to không vượt quá 7 ngày (kèm 1 giây sai số làm tròn)
  const rangeDurationMs = endUtc.getTime() - startUtc.getTime();
  if (rangeDurationMs > SEVEN_DAYS_MS + 1000) {
    throw new BadRequestException('Khoảng thời gian truy vấn tối đa không vượt quá 7 ngày.');
  }
}
