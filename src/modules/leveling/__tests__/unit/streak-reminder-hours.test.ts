import { describe, expect, it } from 'vitest';
import { isWibQuietHoursOpen } from '../../application/run-streak-reminder.use-case';

describe('isWibQuietHoursOpen', () => {
  it('08:00 WIB terbuka', () => {
    // 01:00 UTC = 08:00 WIB
    expect(isWibQuietHoursOpen(Date.UTC(2026, 9, 28, 1, 0, 0))).toBe(true);
  });

  it('19:59 WIB terbuka, 20:00 tutup', () => {
    expect(isWibQuietHoursOpen(Date.UTC(2026, 9, 28, 12, 59, 0))).toBe(true);
    expect(isWibQuietHoursOpen(Date.UTC(2026, 9, 28, 13, 0, 0))).toBe(false);
  });

  it('07:59 WIB tutup', () => {
    expect(isWibQuietHoursOpen(Date.UTC(2026, 9, 28, 0, 59, 0))).toBe(false);
  });
});
