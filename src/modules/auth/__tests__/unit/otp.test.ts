import { describe, it, expect, afterEach } from 'vitest';
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

describe('otp utils', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('generate 6 karakter 0-9A-Z', () => {
    const allowed = new Set(OTP_ALPHABET);
    for (let i = 0; i < 20; i += 1) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_CODE_LENGTH);
      expect([...code].every((ch) => allowed.has(ch))).toBe(true);
    }
  });

  it('staging: selalu STAGING_OTP_CODE (111-111)', () => {
    process.env.NODE_ENV = 'staging';
    for (let i = 0; i < 5; i += 1) {
      expect(generateOtpCode()).toBe(STAGING_OTP_CODE);
    }
    expect(formatOtpDisplay(STAGING_OTP_CODE)).toBe('111-111');
  });

  it('format tampilan XXX-YYY', () => {
    expect(formatOtpDisplay('A4K9M2')).toBe('A4K-9M2');
  });

  it('menerima A4K9M2, A4K-9M2, atau huruf kecil', () => {
    expect(normalizeOtpCode('A4K9M2')).toBe('A4K9M2');
    expect(normalizeOtpCode('A4K-9M2')).toBe('A4K9M2');
    expect(normalizeOtpCode('a4k-9m2')).toBe('A4K9M2');
    expect(normalizeOtpCode('A4K9')).toBeNull();
    expect(normalizeOtpCode('A4K9M2XP')).toBeNull();
  });

  it('hash SHA-256 userId:code', () => {
    expect(hashOtp('user-1', 'A4K9M2')).toBe(hashToken('user-1:A4K9M2'));
  });
});
