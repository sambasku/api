import { describe, expect, it } from 'vitest';
import {
  ensureOneMainImage,
  mapImages,
} from '../../domain/entities/culinary.entity';
import { imagesToJson } from '../../application/use-cases/culinary.use-cases';

describe('ensureOneMainImage / mapImages / imagesToJson', () => {
  it('tanpa isMain → index 0 jadi cover', () => {
    const out = ensureOneMainImage([
      { isMain: false, url: 'a' },
      { isMain: false, url: 'b' },
    ]);
    expect(out[0].isMain).toBe(true);
    expect(out[1].isMain).toBe(false);
  });

  it('true pertama menang; true kedua dilucuti', () => {
    const out = ensureOneMainImage([
      { isMain: true, url: 'a' },
      { isMain: true, url: 'b' },
    ]);
    expect(out.map((i) => i.isMain)).toEqual([true, false]);
  });

  it('mapImages baca JSON lama tanpa isMain → cover di wire', () => {
    const raw = JSON.stringify([
      { url: 'https://cdn.example/a.webp', isMain: false },
      { url: 'https://cdn.example/b.webp', isMain: false },
    ]);
    const imgs = mapImages(raw);
    expect(imgs[0].isMain).toBe(true);
    expect(imgs[1].isMain).toBe(false);
  });

  it('imagesToJson tulis tanpa flag → isMain true di index 0', () => {
    const json = imagesToJson([
      { url: 'https://cdn.example/a.webp' },
      { url: 'https://cdn.example/b.webp', isMain: false },
    ]);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json!) as Array<{ isMain: boolean; url: string }>;
    expect(parsed[0].isMain).toBe(true);
    expect(parsed[1].isMain).toBe(false);
  });
});
