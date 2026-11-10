import { describe, expect, it } from 'vitest';
import {
  JINYE_CREATE_QUOTA_MS,
  jinyeCreateQuotaLimited,
} from '../../application/utils/jinye-quota';

describe('jinyeCreateQuotaLimited', () => {
  it('sisa < 60 detik → copy detik', () => {
    const out = jinyeCreateQuotaLimited(JINYE_CREATE_QUOTA_MS - 30_000);
    expect(out.retryAfterSeconds).toBe(30);
    expect(out.message).toContain('30 detik');
    expect(out.message).toContain('1 jam terakhir');
  });

  it('sisa menit → copy menit', () => {
    const out = jinyeCreateQuotaLimited(JINYE_CREATE_QUOTA_MS - 45 * 60_000);
    expect(out.retryAfterSeconds).toBe(45 * 60);
    expect(out.message).toContain('45 menit');
  });
});
