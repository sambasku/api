import { describe, expect, it } from 'vitest';
import {
  isAllowedStockImageUrl,
  isStockWordImageProvider,
  resolveWordImageProvider,
  stockImageAttribution,
} from '../../domain/word-image-provider';
import { wordImageInputSchema } from '../../presentation/v1/validators/word-image-input';

describe('word-image-provider', () => {
  it('mengenali provider stock', () => {
    expect(isStockWordImageProvider('pexels')).toBe(true);
    expect(isStockWordImageProvider('github')).toBe(false);
  });

  it('resolve: stock/imagekit dari client; absen/github → storage aktif', () => {
    expect(resolveWordImageProvider('pexels', 'github')).toBe('pexels');
    expect(resolveWordImageProvider(undefined, 'github')).toBe('github');
    expect(resolveWordImageProvider('github', 'github')).toBe('github');
    expect(resolveWordImageProvider('imagekit', 'github')).toBe('imagekit');
  });

  it('allowlist URL per provider', () => {
    expect(
      isAllowedStockImageUrl('pexels', 'https://images.pexels.com/photos/1/a.jpg'),
    ).toBe(true);
    expect(isAllowedStockImageUrl('pexels', 'https://evil.example/a.jpg')).toBe(false);
    expect(isAllowedStockImageUrl('unsplash', 'https://images.unsplash.com/photo-1')).toBe(true);
    expect(isAllowedStockImageUrl('openverse', 'https://any-cdn.example/x.jpg')).toBe(true);
    expect(isAllowedStockImageUrl('openverse', 'http://insecure.example/x.jpg')).toBe(false);
  });
});

describe('wordImageInputSchema', () => {
  it('menerima gambar stock dengan provider + URL cocok', () => {
    const parsed = wordImageInputSchema.parse({
      url: 'https://images.pexels.com/photos/42/food.jpg',
      provider: 'pexels',
      provider_file_id: 'pexels-42',
      alt_text: 'Foto: Chef / pexels',
      is_primary: true,
    });
    expect(parsed.provider).toBe('pexels');
  });

  it('menolak URL yang tidak cocok provider stock', () => {
    const result = wordImageInputSchema.safeParse({
      url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/x.jpg',
      provider: 'pexels',
      provider_file_id: 'pexels-1',
    });
    expect(result.success).toBe(false);
  });

  it('menerima upload tanpa provider (storage aktif di mapper)', () => {
    const parsed = wordImageInputSchema.parse({
      url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/words/01.jpg',
      provider_file_id: 'assets/words/01.jpg',
    });
    expect(parsed.provider).toBeUndefined();
  });

  it('menerima atribusi stock dan menolak URL atribusi non-https', () => {
    const base = {
      url: 'https://images.unsplash.com/photo-1',
      provider: 'unsplash',
      provider_file_id: 'abc',
    };
    const parsed = wordImageInputSchema.parse({
      ...base,
      attribution: { name: 'Ada', url: 'https://unsplash.com/@ada' },
    });
    expect(parsed.attribution?.name).toBe('Ada');
    expect(
      wordImageInputSchema.safeParse({
        ...base,
        attribution: { name: 'Ada', url: 'http://unsplash.com/@ada' },
      }).success,
    ).toBe(false);
  });
});

describe('stockImageAttribution', () => {
  const attribution = { name: 'Ada', license: 'CC BY 2.0' };

  it('disimpan untuk provider stock, dibuang untuk upload user', () => {
    expect(stockImageAttribution('openverse', attribution)).toEqual(attribution);
    expect(stockImageAttribution('github', attribution)).toBeNull();
    expect(stockImageAttribution('imagekit', attribution)).toBeNull();
    expect(stockImageAttribution('pixabay', undefined)).toBeNull();
  });
});
