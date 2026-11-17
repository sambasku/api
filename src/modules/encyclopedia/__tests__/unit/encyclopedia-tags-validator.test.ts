import { describe, it, expect } from 'vitest';
import { submitContributionBodySchema } from '../../presentation/v1/validators/encyclopedia.validator';

describe('encyclopedia tags validator', () => {
  const base = {
    kind: 'new' as const,
    title: 'Judul Artikel Uji',
    excerpt: '',
    body_md: 'Isi artikel uji tags.',
    category_id: 'sejarah',
  };

  it('lowercase otomatis untuk tag berhuruf besar', () => {
    const parsed = submitContributionBodySchema.parse({
      ...base,
      tags: ['Sejarah', 'ISTANA', 'Budaya-Lokal'],
    });
    expect(parsed.tags).toEqual(['sejarah', 'istana', 'budaya-lokal']);
  });

  it('dedupe setelah lowercase', () => {
    const parsed = submitContributionBodySchema.parse({
      ...base,
      tags: ['Sejarah', 'sejarah', 'SEJARAH'],
    });
    expect(parsed.tags).toEqual(['sejarah']);
  });

  it('tetap tolak karakter selain slug', () => {
    const result = submitContributionBodySchema.safeParse({
      ...base,
      tags: ['ada spasi'],
    });
    expect(result.success).toBe(false);
  });
});
