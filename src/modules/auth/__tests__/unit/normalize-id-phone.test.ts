import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizeIdPhone } from '../../presentation/v1/validators/register.validator';

describe('normalizePhone', () => {
  it('mengubah digit nasional ID ke 62… (tanpa +)', () => {
    expect(normalizePhone('89988887777')).toBe('6289988887777');
  });

  it('menerima 08…, +62…, dan 62…', () => {
    expect(normalizePhone('089988887777')).toBe('6289988887777');
    expect(normalizePhone('+6289988887777')).toBe('6289988887777');
    expect(normalizePhone('6289988887777')).toBe('6289988887777');
  });

  it('menerima nomor internasional negara lain (tanpa +)', () => {
    expect(normalizePhone('60123456789')).toBe('60123456789');
    expect(normalizePhone('+60123456789')).toBe('60123456789');
    expect(normalizePhone('6591234567')).toBe('6591234567');
  });

  it('kosong → null', () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('tidak valid → sentinel', () => {
    expect(normalizePhone('123')).toBe('__INVALID__');
    expect(normalizePhone('0123')).toBe('__INVALID__');
  });

  it('normalizeIdPhone tetap alias ke normalizePhone', () => {
    expect(normalizeIdPhone('81234567890')).toBe('6281234567890');
    expect(normalizeIdPhone('60123456789')).toBe('60123456789');
  });
});
