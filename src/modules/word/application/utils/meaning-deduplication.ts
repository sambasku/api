import { and, eq, inArray, isNull } from 'drizzle-orm';
import { meanings, meaningTranslations } from '@/shared/database/drizzle/schema';
import { isPlaceholderMeaningText, normalizeMeaningText } from './normalize-meaning-text';

/**
 * Fingerprint makna untuk deduplikasi (case-insensitive, placeholder-aware).
 *
 * Beda dari `meaningFingerprint` di `import-words.ts`: fingerprint ini
 * menganggap placeholder "-" dan kosong sebagai DISTINCT (bukan sama),
 * supaya makna tanpa definisi tidak dianggap duplikat dengan makna
 * yang punya definisi berbeda.
 *
 * Format: `<hasDef>\0<normalizedDef>\0<hasTr>\0<normalizedTr>`
 * - hasDef/hasTr = '1' atau '0' (memisahkan "tanpa definisi" dari
 *   "definisi placeholder" agar tidak dianggap sama).
 * - `translations` (opsional): kalau diisi, semua padanan ikut jadi kunci
 *   (urut, dinormalisasi) - dua makna dianggap sama hanya kalau set
 *   padanannya sama, bukan salah satu saja.
 */
export function meaningDeduplicationFingerprint(input: {
  definition: string;
  translation?: string;
  translations?: { languageId: string; translationText: string }[];
  isHaveDefinition: boolean;
  isHaveTranslation: boolean;
}): string {
  const hasDef = input.isHaveDefinition && !isPlaceholderMeaningText(input.definition);
  const def = hasDef ? normalizeMeaningText(input.definition) : '';

  if (input.translations) {
    const tr = input.isHaveTranslation
      ? input.translations
          .filter((t) => !isPlaceholderMeaningText(t.translationText))
          .map((t) => `${t.languageId}\0${normalizeMeaningText(t.translationText)}`)
          .sort()
          .join('\u0001')
      : '';
    return `${hasDef ? '1' : '0'}\0${def}\0${input.isHaveTranslation ? '1' : '0'}\0${tr}`;
  }

  const hasTr = input.isHaveTranslation && !isPlaceholderMeaningText(input.translation ?? '');
  const tr = hasTr ? normalizeMeaningText(input.translation ?? '') : '';
  return `${hasDef ? '1' : '0'}\0${def}\0${hasTr ? '1' : '0'}\0${tr}`;
}

/**
 * Peta indeks makna duplikat dalam satu payload (create/edit/inline).
 * Duplikat "menumpang" pada indeks pertama yang sama (firstIndex) supaya
 * provenance `inherited_from_meaning_id` tetap sejajar dengan urutan kiriman.
 */
export function mapDuplicateMeaningIndexes(
  items: {
    definition: string;
    isHaveDefinition?: boolean;
    isHaveTranslation?: boolean;
    translations?: { languageId: string; translationText: string }[];
  }[],
): { firstIndex: number[]; isDuplicate: boolean[] } {
  const seen = new Map<string, number>();
  const firstIndex: number[] = [];
  const isDuplicate: boolean[] = [];
  items.forEach((item, index) => {
    const fp = meaningDeduplicationFingerprint({
      definition: item.definition,
      translations: item.translations ?? [],
      isHaveDefinition: item.isHaveDefinition ?? true,
      isHaveTranslation: item.isHaveTranslation ?? (item.translations?.length ?? 0) > 0,
    });
    const first = seen.get(fp);
    if (first === undefined) {
      seen.set(fp, index);
      firstIndex.push(index);
      isDuplicate.push(false);
    } else {
      firstIndex.push(first);
      isDuplicate.push(true);
    }
  });
  return { firstIndex, isDuplicate };
}

/** Fingerprint satu makna dari baris DB + padanannya. */
export function rowMeaningFingerprint(
  row: { definition: string; isHaveDefinition: boolean; isHaveTranslation: boolean },
  translations: { languageId: string; translationText: string }[],
): string {
  return meaningDeduplicationFingerprint({
    definition: row.definition,
    translations,
    isHaveDefinition: row.isHaveDefinition,
    isHaveTranslation: row.isHaveTranslation,
  });
}

/**
 * Muat sidik makna aktif (tanpa soft-delete) satu kata, dipetakan per id.
 * Satu query ke meanings + satu query ke meaningTranslations (tanpa N+1).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMeaningFingerprintById(
  tx: any,
  wordId: string,
): Promise<Map<string, string>> {
  const rows = await tx
    .select({
      id: meanings.id,
      definition: meanings.definition,
      isHaveDefinition: meanings.isHaveDefinition,
      isHaveTranslation: meanings.isHaveTranslation,
    })
    .from(meanings)
    .where(and(eq(meanings.wordId, wordId), isNull(meanings.deletedAt)));

  if (rows.length === 0) return new Map();

  const ids = rows.map((r: { id: string }) => r.id);
  const translations = await tx
    .select({
      meaningId: meaningTranslations.meaningId,
      languageId: meaningTranslations.languageId,
      translationText: meaningTranslations.translationText,
    })
    .from(meaningTranslations)
    .where(
      and(inArray(meaningTranslations.meaningId, ids), isNull(meaningTranslations.deletedAt)),
    );

  const trByMeaning = new Map<string, { languageId: string; translationText: string }[]>();
  for (const t of translations) {
    const list = trByMeaning.get(t.meaningId) ?? [];
    list.push({ languageId: t.languageId, translationText: t.translationText });
    trByMeaning.set(t.meaningId, list);
  }

  const byId = new Map<string, string>();
  for (const r of rows) {
    byId.set(r.id, rowMeaningFingerprint(r, trByMeaning.get(r.id) ?? []));
  }
  return byId;
}

/** Himpunan sidik makna aktif satu kata (untuk cek "sudah ada"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMeaningFingerprints(tx: any, wordId: string): Promise<Set<string>> {
  return new Set((await loadMeaningFingerprintById(tx, wordId)).values());
}
