import { describe, it, expect } from 'vitest';
import {
  detectRhyme,
  extractLastWord,
  suffixRhymes,
} from '../../application/utils/rhyme-check';

describe('extractLastWord', () => {
  it('strip tanda baca trailing', () => {
    expect(extractLastWord('Pergi berjalan ke Sambas.')).toBe('sambas');
    expect(extractLastWord('Membeli ikan,')).toBe('ikan');
  });

  it('kapitalisasi dinormalisasi', () => {
    expect(extractLastWord('SAMBAS')).toBe('sambas');
  });

  it('spasi berlebih dinormalisasi', () => {
    expect(extractLastWord('  ke   pasar   ')).toBe('pasar');
  });

  it('baris tanpa kata → null', () => {
    expect(extractLastWord('...')).toBeNull();
    expect(extractLastWord('   ')).toBeNull();
  });
});

describe('suffixRhymes', () => {
  it('suffix sama → berima', () => {
    expect(suffixRhymes('sambas', 'rambas')).toBe(true);
    expect(suffixRhymes('ikan', 'makan')).toBe(true);
  });

  it('ejaan beda bunyi beda → tidak berima', () => {
    expect(suffixRhymes('jalan', 'capal')).toBe(false);
  });

  it('kata pendek dibanding penuh', () => {
    expect(suffixRhymes('aku', 'aku')).toBe(true);
  });
});

const ABAB_OK = ['Pergi berjalan ke Sambas', 'Membeli ikan di pasar', 'Pulang bawa rumbas', 'Hatiku girang bersinar'];
const AAAA_OK = ['Waktu sarapan makan', 'Di warung ada ikan', 'Kucing minta pakan', 'Burung tengok takan'];

describe('detectRhyme', () => {
  it('ABAB valid → ok', () => {
    const r = detectRhyme(ABAB_OK, 'ABAB');
    expect(r.ok).toBe(true);
  });

  it('AAAA valid → ok', () => {
    const r = detectRhyme(AAAA_OK, 'AAAA');
    expect(r.ok).toBe(true);
  });

  it('AAAA dengan satu baris beda → RHYME_MISMATCH', () => {
    const r = detectRhyme(
      ['satu dua tiga', 'empat lima enam', 'tujuh delapan sembilan', 'sepuluh sebelas dua'],
      'AAAA',
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'RHYME_MISMATCH') {
      expect(r.pairs.length).toBeGreaterThan(0);
    }
  });

  it('AABB dibawah ABAB → pasangan yang tidak berima dilaporkan', () => {
    const aabb = ['pergi ke pasar', 'membeli gula', 'pulang bawa sasar', 'manis di bibir'];
    const r = detectRhyme(aabb, 'ABAB');
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'RHYME_MISMATCH') {
      expect(r.pairs).toContainEqual([2, 4]);
    }
  });

  it('kata akhir tak terdeteksi → LAST_WORD_UNDETECTED', () => {
    const r = detectRhyme(['satu', 'dua', '!!!', 'empat'], 'ABAB');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('LAST_WORD_UNDETECTED');
  });

  it('rima ambigu (suffix pendek) → ok + warning', () => {
    // "mata"/"cita": berima hanya via suffix 2 huruf ("ta") - ambigu.
    const r = detectRhyme(
      ['Melihat indah mata', 'Sungguh enak makan', 'Bersyukur dapat cita', 'Jangan lupa bukan'],
      'ABAB',
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warning).not.toBeNull();
  });
});
