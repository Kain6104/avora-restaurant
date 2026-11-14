import {
  formatVietnamDateTime,
  getCurrentVietnamIso,
  getVietnamBusinessDayBounds,
  getVietnamDateString,
  getVietnamHour,
  parseIsoToUtcDate,
} from './vietnam-time.util';

describe('Vietnam Timezone Standardization (Asia/Ho_Chi_Minh)', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'UTC';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it('converts UTC instants to exact VN boundary hours (00:00, 08:00, 12:00, 18:00, 23:59)', () => {
    expect(formatVietnamDateTime('2026-11-11T17:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '12/11/2026 00:00:00',
    );
    expect(formatVietnamDateTime('2026-11-12T01:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '12/11/2026 08:00:00',
    );
    expect(formatVietnamDateTime('2026-11-12T05:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '12/11/2026 12:00:00',
    );
    expect(formatVietnamDateTime('2026-11-12T11:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '12/11/2026 18:00:00',
    );
    expect(formatVietnamDateTime('2026-11-12T16:59:59.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '12/11/2026 23:59:59',
    );
  });

  it('handles month and year rollovers accurately in Asia/Ho_Chi_Minh', () => {
    expect(formatVietnamDateTime('2026-10-31T17:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '01/11/2026 00:00:00',
    );
    expect(formatVietnamDateTime('2026-02-28T17:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '01/03/2026 00:00:00',
    );
    expect(formatVietnamDateTime('2025-12-31T16:59:59.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '31/12/2025 23:59:59',
    );
    expect(formatVietnamDateTime('2025-12-31T17:00:00.000Z', 'DD/MM/YYYY HH:mm:ss')).toBe(
      '01/01/2026 00:00:00',
    );
  });

  it('normalizes +07:00, Z, and naive VN strings to identical UTC instant without double-offset', () => {
    const zDate = parseIsoToUtcDate('2026-11-12T07:14:07.000Z');
    const offsetDate = parseIsoToUtcDate('2026-11-12T14:14:07+07:00');
    const naiveVnDate = parseIsoToUtcDate('2026-11-12T14:14:07');

    expect(zDate.toISOString()).toBe('2026-11-12T07:14:07.000Z');
    expect(offsetDate.toISOString()).toBe('2026-11-12T07:14:07.000Z');
    expect(naiveVnDate.toISOString()).toBe('2026-11-12T07:14:07.000Z');
    expect(getVietnamHour(zDate)).toBe(14);
    expect(getVietnamDateString(zDate)).toBe('2026-11-12');
    expect(getCurrentVietnamIso(zDate)).toBe('2026-11-12T14:14:07+07:00');
  });

  it('builds exact UTC bounds for a Vietnam business date', () => {
    const bounds = getVietnamBusinessDayBounds('2026-11-12');
    expect(bounds.startUtc.toISOString()).toBe('2026-11-11T17:00:00.000Z');
    expect(bounds.endUtc.toISOString()).toBe('2026-11-12T16:59:59.999Z');
  });
});

