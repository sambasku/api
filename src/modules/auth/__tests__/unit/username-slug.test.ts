import { describe, it, expect } from 'vitest';
import {
  buildUsernameCandidates,
  isSyntheticOauthEmail,
  randomUsernameToken,
  slugifyUsername,
  syntheticOauthEmail,
  USERNAME_HANDLE_REGEX,
} from '../../application/utils/username-slug';
import { isReservedHandle, RESERVED_HANDLES } from '../../application/utils/reserved-handles';

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

  it('nama pendek dipad ke panjang minimal handle', () => {
    expect(slugifyUsername('ab')).toBe('ab0');
    expect(slugifyUsername('a')).toBe('a00');
  });
});

describe('buildUsernameCandidates', () => {
  it('kandidat pertama = base slug', () => {
    const candidates = buildUsernameCandidates('Budi Santoso', 'budi@x.com', 'email');
    expect(candidates[0]).toBe('budi_santoso');
  });

  it('kandidat kedua = base_provider (tanpa probe SELECT)', () => {
    const candidates = buildUsernameCandidates('Budi', null, 'google');
    expect(candidates[1]).toBe('budi_google');
  });

  it('kandidat ketiga = base_xxxxx_provider', () => {
    const candidates = buildUsernameCandidates('Budi', null, 'google');
    expect(candidates[2]).toMatch(/^budi_[a-z0-9]{5}_google$/);
  });

  it('semua kandidat valid sebagai handle mention', () => {
    const candidates = buildUsernameCandidates('Budi Santoso', 'budi@x.com', 'email');
    for (const c of candidates) {
      expect(USERNAME_HANDLE_REGEX.test(c)).toBe(true);
    }
  });

  it('kandidat unik (tanpa duplikat)', () => {
    const candidates = buildUsernameCandidates('Budi', 'budi@x.com', 'email');
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it('fallback terakhir tetap handle valid walau base panjang', () => {
    const candidates = buildUsernameCandidates('a'.repeat(40), null, 'email');
    for (const c of candidates) {
      expect(c.length).toBeLessThanOrEqual(30);
      expect(USERNAME_HANDLE_REGEX.test(c)).toBe(true);
    }
  });

  it('fallback dari email bila nama kosong', () => {
    const candidates = buildUsernameCandidates('', 'budi.santoso@gmail.com', 'email');
    expect(candidates[0]).toBe('budi.santoso');
  });

  it('handle reserved di-suffix, bukan dipakai langsung', () => {
    const candidates = buildUsernameCandidates('Admin', null, 'email');
    expect(candidates[0]).toBe('admin_user');
    const anonim = buildUsernameCandidates('anonim', null, 'email');
    expect(anonim[0]).toBe('anonim_user');
  });
});

describe('randomUsernameToken', () => {
  it('token acak panjang 5', () => {
    expect(randomUsernameToken(5)).toMatch(/^[a-z0-9]{5}$/);
  });
});

describe('reserved handles', () => {
  it('menolak segment route + peran + user sistem', () => {
    for (const h of ['me', 'suggest', 'admin', 'root', 'contributor', 'anonim', 'ADMIN']) {
      expect(isReservedHandle(h)).toBe(true);
    }
  });

  it('mengizinkan handle biasa', () => {
    expect(isReservedHandle('budi_santoso')).toBe(false);
    expect(isReservedHandle('budi')).toBe(false);
  });

  it('daftar reserved tidak pernah kosong', () => {
    expect(RESERVED_HANDLES.size).toBeGreaterThan(10);
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
