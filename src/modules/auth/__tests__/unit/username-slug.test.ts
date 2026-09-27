import { describe, it, expect } from 'vitest';
import {
  allocateUniqueUsername,
  isSyntheticOauthEmail,
  slugifyUsername,
  syntheticOauthEmail,
} from '../../application/utils/username-slug';

describe('slugifyUsername', () => {
  it('menormalisasi nama ke handle', () => {
    expect(slugifyUsername('Budi Santoso')).toBe('budi-santoso');
    expect(slugifyUsername('Hello_World.99')).toBe('hello_world.99');
  });

  it('fallback user jika kosong', () => {
    expect(slugifyUsername('')).toBe('user');
    expect(slugifyUsername('!!!')).toBe('user');
  });
});

describe('allocateUniqueUsername', () => {
  it('mengembalikan base bila bebas', async () => {
    const name = await allocateUniqueUsername(async () => null, 'Budi', 'budi@x.com');
    expect(name).toBe('budi');
  });

  it('menambah sufiks bila bentrok', async () => {
    const taken = new Set(['budi', 'budi2']);
    const name = await allocateUniqueUsername(
      async (u) => (taken.has(u) ? { id: u } : null),
      'Budi',
      null,
    );
    expect(name).toBe('budi3');
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
