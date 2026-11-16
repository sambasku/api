import { describe, expect, it } from 'vitest';
import {
  assertExcerptRights,
  exceedsFairQuoteLimit,
  excerptPayloadSchema,
  newKaryaPayloadSchema,
  submitKaryaContributionBodySchema,
} from '../../presentation/v1/validators/karya.validator';

const baseMusic = {
  title: 'Lagu Sambas',
  year: 2020,
  kind: 'music' as const,
  sambas_connections: [{ type: 'language' as const, note: 'Lirik bahasa Sambas' }],
  credits: [{ role: 'vocal', name_text: 'Ahmad' }],
};

describe('newKaryaPayloadSchema', () => {
  it('menerima musik minimal valid', () => {
    const parsed = newKaryaPayloadSchema.safeParse(baseMusic);
    expect(parsed.success).toBe(true);
  });

  it('menolak tanpa sambas_connections', () => {
    const parsed = newKaryaPayloadSchema.safeParse({
      ...baseMusic,
      sambas_connections: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak musik tanpa credit vocal', () => {
    const parsed = newKaryaPayloadSchema.safeParse({
      ...baseMusic,
      credits: [{ role: 'feat', name_text: 'Budi' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('menerima film dengan director', () => {
    const parsed = newKaryaPayloadSchema.safeParse({
      title: 'Film Kampung',
      year: 2019,
      kind: 'film',
      sambas_connections: [
        { type: 'location', note: 'Syuting di Sambas kota' },
      ],
      credits: [{ role: 'director', name_text: 'Siti' }],
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak role film pada kind music', () => {
    const parsed = newKaryaPayloadSchema.safeParse({
      ...baseMusic,
      credits: [
        { role: 'vocal', name_text: 'Ahmad' },
        { role: 'director', name_text: 'Salah' },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('assertExcerptRights / fair quote', () => {
  it('menolak unknown', () => {
    const r = assertExcerptRights({
      text: 'satu baris',
      rightsStatus: 'unknown',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EXCERPT_RIGHTS_UNKNOWN');
  });

  it('menerima fair_quote pendek', () => {
    const r = assertExcerptRights({
      text: 'baris satu\nbaris dua',
      rightsStatus: 'fair_quote',
    });
    expect(r.ok).toBe(true);
  });

  it('menolak fair_quote terlalu panjang', () => {
    const text = Array.from({ length: 5 }, (_, i) => `baris ${i}`).join('\n');
    expect(exceedsFairQuoteLimit(text)).toBe(true);
    const r = assertExcerptRights({ text, rightsStatus: 'fair_quote' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EXCERPT_FAIR_QUOTE_TOO_LONG');
  });

  it('A2: teks panjang butuh permission + note', () => {
    const text = 'x'.repeat(501);
    const missing = assertExcerptRights({
      text,
      rightsStatus: 'permission',
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('EXCERPT_RIGHTS_NOTE_REQUIRED');

    const ok = assertExcerptRights({
      text,
      rightsStatus: 'permission',
      rightsNote: 'Izin tertulis dari pencipta, 2024',
    });
    expect(ok.ok).toBe(true);
  });

  it('menolak teks panjang tanpa A2', () => {
    const text = 'x'.repeat(501);
    const r = assertExcerptRights({ text, rightsStatus: 'fair_quote' });
    expect(r.ok).toBe(false);
  });
});

describe('excerptPayloadSchema', () => {
  it('menerima cuplikan fair_quote', () => {
    const parsed = excerptPayloadSchema.safeParse({
      kind: 'lyrics',
      text: 'Ampun ampun\nDari Sambas',
      rights_status: 'fair_quote',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('submitKaryaContributionBodySchema', () => {
  it('kind=new menolak karya_id', () => {
    const parsed = submitKaryaContributionBodySchema.safeParse({
      kind: 'new',
      karya_id: '01JC0Z3M9QWERTYUIOPASDFGHJ',
      payload: baseMusic,
    });
    expect(parsed.success).toBe(false);
  });

  it('kind=excerpt wajib karya_id + gate hak', () => {
    const bad = submitKaryaContributionBodySchema.safeParse({
      kind: 'excerpt',
      payload: {
        kind: 'lyrics',
        text: 'ok',
        rights_status: 'unknown',
      },
    });
    expect(bad.success).toBe(false);

    const good = submitKaryaContributionBodySchema.safeParse({
      kind: 'excerpt',
      karya_id: '01JC0Z3M9QWERTYUIOPASDFGHJ',
      payload: {
        kind: 'lyrics',
        text: 'ok pendek',
        rights_status: 'fair_quote',
      },
    });
    expect(good.success).toBe(true);
  });
});
