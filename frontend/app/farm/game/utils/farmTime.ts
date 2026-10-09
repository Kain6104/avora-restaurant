/**
 * AVORA FARM - Client Vietnam Time Utilities (Asia/Ho_Chi_Minh - UTC+07:00)
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo giờ Việt Nam
 */
export function getClientVietnamDateKey(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (e) {
    // Fallback nếu browser không hỗ trợ Intl timeZone
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const vnTime = new Date(utcTime + 7 * 3600000);
    return vnTime.toISOString().slice(0, 10);
  }
}

/**
 * Tính số giây còn lại cho tới 00:00:00 ngày tiếp theo theo giờ Việt Nam
 */
export function getSecondsUntilVietnamMidnight(): number {
  try {
    const now = new Date();
    // Lấy thời gian hiện tại theo giờ Việt Nam
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: VIETNAM_TIMEZONE,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    for (const p of parts) {
      if (p.type === 'hour') hours = parseInt(p.value, 10);
      if (p.type === 'minute') minutes = parseInt(p.value, 10);
      if (p.type === 'second') seconds = parseInt(p.value, 10);
    }
    const currentSeconds = hours * 3600 + minutes * 60 + seconds;
    const totalSecondsInDay = 86400;
    return Math.max(0, totalSecondsInDay - currentSeconds);
  } catch (e) {
    return 0;
  }
}

/**
 * Định dạng số giây thành chuỗi HH:mm:ss
 */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
