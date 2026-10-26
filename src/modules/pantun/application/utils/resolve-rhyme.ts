import {
  closestRhymeScheme,
  detectRhyme,
  pickRhymeScheme,
  type RhymeScheme,
} from './rhyme-check';
import { ValidationError } from '@/shared/errors/app-error';

/**
 * Tentukan skema rima final: pakai pilihan user bila ada, selain itu
 * deteksi otomatis (ABAB dulu, lalu AAAA). Rima divalidasi di sini supaya
 * create + reply berperilaku identik.
 *
 * @returns skema yang dipakai untuk menyimpan.
 * @throws ValidationError bila tak ada skema yang cocok / kata akhir hilang.
 */
export function resolveRhymeScheme(
  cleaned: string[],
  requested?: RhymeScheme | null,
): RhymeScheme {
  const scheme = requested ?? pickRhymeScheme(cleaned);
  if (scheme == null) {
    throw new ValidationError([
      {
        field: 'lines',
        message:
          'Baris pantun belum berima. Coba akhiran yang sama di baris 1 & 3 dan 2 & 4, atau semuanya.',
      },
    ]);
  }

  const check = detectRhyme(cleaned, scheme);
  if (!check.ok) {
    if (check.reason === 'LAST_WORD_UNDETECTED') {
      throw new ValidationError([
        {
          field: `lines[${check.lineIndex}]`,
          message: 'Kata akhir baris ini tidak terdeteksi. Perbaiki ya.',
        },
      ]);
    }
    const pairs = check.pairs.map(([a, b]) => `baris ${a} & ${b}`).join(', ');
    throw new ValidationError([
      {
        field: 'lines',
        message: `Pola rima ${closestRhymeScheme(cleaned)} belum pas: ${pairs} belum berima.`,
      },
    ]);
  }
  return scheme;
}
