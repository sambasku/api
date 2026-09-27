import { describe, it, expect } from 'vitest';
import {
  allocateUniqueUsername,
  isSyntheticOauthEmail,
  randomUsernameToken,
  slugifyUsername,
  syntheticOauthEmail,
} from '../../application/utils/username-slug';

describe('slugifyUsername', () => {
  it('menormalisasi nama ke handle underscore (tanpa hyphen)', () => {
    expect(slugifyUsername('Budi Santoso')).toBe('budi_santoso');
    expect(slugifyUsername('Hello_World.99')).toBe('hello_world.99');
    expect(slugifyUsername('budi-santoso')).toBe('budi_santoso');
  });

  it('fallback user jika kosong', () => {
    expect(slugifyUsername('')).toBe('user');
    expect(slugifyUsername('!!!')).toBe('user');
  });
});

describe('allocateUniqueUsername', () => {
  it('mengembalikan base bila bebas', async () => {
    const name = await allocateUniqueUsername(async () => null, 'Budi', 'budi@x.com', 'email');
    expect(name).toBe('budi');
  });

  it('bentrok + provider → base_provider', async () => {
    const taken = new Set(['budi']);
    const name = await allocateUniqueUsername(
      async (u) => (taken.has(u) ? { id: u } : null),
      'Budi',
      null,
      'google',
    );
    expect(name).toBe('budi_google');
  });

  it('bentrok berlapis → pola base_xxxxx_provider', async () => {
    const taken = new Set(['budi', 'budi_google']);
    const name = await allocateUniqueUsername(
      async (u) => (taken.has(u) ? { id: u } : null),
      'Budi',
      null,
      'google',
    );
    expect(name).toMatch(/^budi_[a-z0-9]{5}_google$/);
  });

  it('token acak panjang 5', () => {
    expect(randomUsernameToken(5)).toMatch(/^[a-z0-9]{5}$/);
  });
});

describe('syntheticOauthEmail', () => {
  it('membuat email lokal non-deliverable', () => {
    expect(syntheticOauthEmail('github', '12345')).toBe(
      'gh_12345@users.noreply.sambasku.local',
    );
    expect(isSyntheticOauthEmail('gh_12345@users.noreply.sambasku.local')).toBe(true);
    expect(isSyntheticOauthEmail('a@gmail.com')).toBe(false);
  });
});
