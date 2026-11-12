import { describe, expect, it } from 'vitest';
import {
  classifyUsernameLocal,
  resolveUsernameAvailability,
} from '../../application/utils/username-availability';

describe('classifyUsernameLocal', () => {
  it('normalisasi + available format', () => {
    expect(classifyUsernameLocal('Warga.Sambas')).toEqual({
      username: 'warga.sambas',
      status: 'available',
    });
  });

  it('pendek → invalid', () => {
    expect(classifyUsernameLocal('abc').status).toBe('invalid');
  });

  it('reserved → reserved', () => {
    // 'system' lolos format 6-30 tapi reserved
    expect(classifyUsernameLocal('system').status).toBe('reserved');
  });
});

describe('resolveUsernameAvailability', () => {
  it('current tanpa hit DB uniqueness', async () => {
    const findByUsername = async () => {
      throw new Error('should not call');
    };
    await expect(
      resolveUsernameAvailability({
        raw: 'budi00',
        currentUsername: 'budi00',
        currentUserId: 'u1',
        findByUsername,
      }),
    ).resolves.toEqual({ username: 'budi00', status: 'current' });
  });

  it('taken bila user lain', async () => {
    await expect(
      resolveUsernameAvailability({
        raw: 'warga.sambas',
        currentUsername: 'budi00',
        currentUserId: 'u1',
        findByUsername: async () => ({ id: 'u2' }),
      }),
    ).resolves.toEqual({ username: 'warga.sambas', status: 'taken' });
  });

  it('available bila kosong', async () => {
    await expect(
      resolveUsernameAvailability({
        raw: 'warga.sambas',
        currentUsername: 'budi00',
        currentUserId: 'u1',
        findByUsername: async () => null,
      }),
    ).resolves.toEqual({ username: 'warga.sambas', status: 'available' });
  });
});
