import { describe, expect, it } from 'vitest';
import { parseRelatedJson, serializeRelatedJson } from '../../domain/karya';
import { karyaRelatedRefSchema } from '../../presentation/v1/validators/karya.validator';

describe('parseRelatedJson', () => {
  it('menerima place dengan slug', () => {
    const refs = parseRelatedJson(
      JSON.stringify([{ kind: 'place', slug: 'pulau-bengkayang' }]),
    );
    expect(refs).toEqual([{ kind: 'place', slug: 'pulau-bengkayang' }]);
  });

  it('skip kind tidak dikenal atau tanpa slug/id', () => {
    const refs = parseRelatedJson(
      JSON.stringify([
        { kind: 'bogus', slug: 'x' },
        { kind: 'word' },
        { kind: 'article', id: '01ABCDEF' },
      ]),
    );
    expect(refs).toEqual([{ kind: 'article', id: '01ABCDEF' }]);
  });

  it('round-trip serialize', () => {
    const input = [
      { kind: 'event' as const, slug: 'hutan-raya' },
      { kind: 'karya' as const, id: '01KARYA123' },
    ];
    const parsed = parseRelatedJson(serializeRelatedJson(input));
    expect(parsed).toEqual(input);
  });
});

describe('karyaRelatedRefSchema', () => {
  it('menolak tanpa slug dan id', () => {
    const parsed = karyaRelatedRefSchema.safeParse({ kind: 'place' });
    expect(parsed.success).toBe(false);
  });
});