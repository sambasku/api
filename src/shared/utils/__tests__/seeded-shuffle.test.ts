import { describe, it, expect } from 'vitest';
import { seededShuffle } from '../seeded-shuffle';

describe('seededShuffle', () => {
  const items = Array.from({ length: 40 }, (_, i) => `w${i}`);

  it('deterministik: seed sama = urutan sama, isi tidak hilang', () => {
    const a = seededShuffle(items, 'user-a:first');
    const b = seededShuffle(items, 'user-a:first');
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...items].sort());
  });

  it('seed beda = urutan beda (deck user tidak seragam)', () => {
    const a = seededShuffle(items, 'user-a:first');
    const b = seededShuffle(items, 'user-b:first');
    expect(a).not.toEqual(items);
    expect(a).not.toEqual(b);
  });
});
