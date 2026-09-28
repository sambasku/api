import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatOtpDisplay,
  generateOtpCode,
  hashOtp,
  normalizeOtpCode,
  OTP_ALPHABET,
  OTP_CODE_LENGTH,
  STAGING_OTP_CODE,
} from '../../application/utils/otp';
import { hashToken } from '../../application/utils/token';

const envState = vi.hoisted(() => ({ NODE_ENV: 'test' as string }));

vi.mock('@/shared/config/env', () => ({
  env: {
    get NODE_ENV() {
      return envState.NODE_ENV;
    },
  },
}));

describe('otp utils', () => {
  beforeEach(() => {
    envState.NODE_ENV = 'test';
  });

  it('generate 8 karakter 0-9A-Z', () => {
    const allowed = new Set(OTP_ALPHABET);
    for (let i = 0; i < 20; i += 1) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_CODE_LENGTH);
      expect([...code].every((ch) => allowed.has(ch))).toBe(true);
    }
  });

  it('staging: selalu STAGING_OTP_CODE (1111-1111)', () => {
    envState.NODE_ENV = 'staging';
    for (let i = 0; i < 5; i += 1) {
      expect(generateOtpCode()).toBe(STAGING_OTP_CODE);
    }
    expect(formatOtpDisplay(STAGING_OTP_CODE)).toBe('1111-1111');
  });

  it('format tampilan XXXX-XXXX', () => {
    expect(formatOtpDisplay('A4K9M2XP')).toBe('A4K9-M2XP');
  });

  it('menerima A4K9M2XP, A4K9-M2XP, atau huruf kecil', () => {
    expect(normalizeOtpCode('A4K9M2XP')).toBe('A4K9M2XP');
    expect(normalizeOtpCode('A4K9-M2XP')).toBe('A4K9M2XP');
    expect(normalizeOtpCode('a4k9-m2xp')).toBe('A4K9M2XP');
    expect(normalizeOtpCode('A4K9')).toBeNull();
    expect(normalizeOtpCode('123-456')).toBeNull();
  });

  it('hash SHA-256 userId:code', () => {
    expect(hashOtp('user-1', 'A4K9M2XP')).toBe(hashToken('user-1:A4K9M2XP'));
  });
});
