import { and, eq, inArray, isNull } from 'drizzle-orm';
import { meanings, meaningTranslations } from '@/shared/database/drizzle/schema';
import { isPlaceholderMeaningText, normalizeMeaningText } from './normalize-meaning-text';

export interface MeaningIdentityInput {
  definition: string;
  translation?: string;
  translations?: { languageId: string; translationText: string }[];
  /** Diabaikan untuk identitas. Teks nyata tetap dihitung. */
  isHaveDefinition?: boolean;
  /** Diabaikan untuk identitas. Teks nyata tetap dihitung. */
  isHaveTranslation?: boolean;
  /** Null dan kosong satu ember. Beda kelas = bukan duplikat. */
  wordClassId?: string | null;
}

/**
 * Fingerprint makna untuk deduplikasi.
 *
 * Kelas kata + definisi + himpunan padanan. Huruf, spasi, dan karakter
 * format diseragamkan. Placeholder "-" dan kosong tidak masuk teks.
 * Flag is_have_definition / is_have_translation tidak menyembunyikan teks.
 *
 * Format: `<classId>\0<def>\0<lang\0text\u0001...>`
 */
export function meaningDeduplicationFingerprint(input: MeaningIdentityInput): string {
  const classId = input.wordClassId ?? '';
  const def = identityDefinition(input.definition);
  const tr = identityTranslations(input);
  return `${classId}\0${def}\0${tr}`;
}

/**
 * Kunci kolom `meanings.dedupe_key`. Null bila tidak ada teks identitas
 * (definisi dan padanan kosong / "-"). Dua makna kosong di kelas yang sama
 * tetap satu sidik, ditolak di aplikasi. Index unik hanya mengunci kunci
 * non-null.
 */
export function meaningDedupeKey(input: MeaningIdentityInput): string | null {
  if (!identityDefinition(input.definition) && !identityTranslations(input)) return null;
  return meaningDeduplicationFingerprint(input);
}

function identityDefinition(definition: string): string {
  return isPlaceholderMeaningText(definition) ? '' : normalizeMeaningText(definition);
}

function identityTranslations(input: MeaningIdentityInput): string {
  if (input.translations) {
    return input.translations
      .filter((t) => !isPlaceholderMeaningText(t.translationText))
      .map((t) => `${t.languageId}\0${normalizeMeaningText(t.translationText)}`)
      .sort()
      .join('\u0001');
  }
  const raw = input.translation ?? '';
  return isPlaceholderMeaningText(raw) ? '' : normalizeMeaningText(raw);
}

/**
 * Peta indeks makna duplikat dalam satu payload (create/edit/inline).
 * Duplikat menumpang pada indeks pertama yang sama.
 */
export function mapDuplicateMeaningIndexes(
  items: {
    definition: string;
    wordClassId?: string | null;
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
      wordClassId: item.wordClassId ?? null,
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

export interface ActiveMeaningIdentity {
  id: string;
  wordClassId: string | null;
  definition: string;
  translations: { languageId: string; translationText: string }[];
  fingerprint: string;
}

/** Fingerprint satu makna dari baris DB + padanannya. */
export function rowMeaningFingerprint(
  row: { definition: string; wordClassId?: string | null },
  translations: { languageId: string; translationText: string }[],
): string {
  return meaningDeduplicationFingerprint({
    definition: row.definition,
    translations,
    wordClassId: row.wordClassId ?? null,
  });
}

/**
 * Muat identitas makna aktif (tanpa soft-delete) satu kata.
 * Satu query meanings + satu query translations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadActiveMeaningIdentities(
  tx: any,
  wordId: string,
): Promise<ActiveMeaningIdentity[]> {
  const rows = await tx
    .select({
      id: meanings.id,
      definition: meanings.definition,
      wordClassId: meanings.wordClassId,
    })
    .from(meanings)
    .where(and(eq(meanings.wordId, wordId), isNull(meanings.deletedAt)));

  if (rows.length === 0) return [];

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

  return rows.map((r: { id: string; definition: string; wordClassId: string | null }) => {
    const tr = trByMeaning.get(r.id) ?? [];
    return {
      id: r.id,
      wordClassId: r.wordClassId,
      definition: r.definition,
      translations: tr,
      fingerprint: rowMeaningFingerprint(r, tr),
    };
  });
}

/** Sidik makna aktif satu kata, dipetakan per id. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMeaningFingerprintById(
  tx: any,
  wordId: string,
): Promise<Map<string, string>> {
  const rows = await loadActiveMeaningIdentities(tx, wordId);
  return new Map(rows.map((r) => [r.id, r.fingerprint]));
}

/** Himpunan sidik makna aktif satu kata. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadMeaningFingerprints(tx: any, wordId: string): Promise<Set<string>> {
  return new Set((await loadMeaningFingerprintById(tx, wordId)).values());
}
