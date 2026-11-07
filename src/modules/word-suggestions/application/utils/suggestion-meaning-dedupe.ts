import { ConflictError } from '@/shared/errors/app-error';
import type { MeaningChange, ProposedChanges } from '../../domain/entities/word-suggestion.entity';
import {
  loadActiveMeaningIdentities,
  meaningDeduplicationFingerprint,
  meaningDedupeKey,
  type ActiveMeaningIdentity,
} from '@/modules/word/application/utils/meaning-deduplication';
import { throwDuplicateMeaningConflict } from '@/modules/word/application/utils/throw-duplicate-meaning-conflict';

export interface SkippedDuplicateMeaning {
  meaningId: string;
  definition: string;
  translationText: string;
}

export interface MeaningApplyPlan {
  /** Indeks `changes.meanings` yang add-nya tidak di-insert. */
  skipAddIndexes: Set<number>;
  skipped: SkippedDuplicateMeaning[];
  /** meaningId -> kunci baru setelah update. */
  updateKeys: Map<string, string | null>;
}

function gloss(translations: { translationText: string }[]): string {
  return translations[0]?.translationText ?? '';
}

function mergedTranslations(
  existing: { languageId: string; translationText: string }[],
  incoming: { languageId: string; translationText: string }[] | undefined,
): { languageId: string; translationText: string }[] {
  const map = new Map(existing.map((t) => [t.languageId, t.translationText]));
  for (const t of incoming ?? []) map.set(t.languageId, t.translationText);
  return [...map.entries()].map(([languageId, translationText]) => ({
    languageId,
    translationText,
  }));
}

function addFingerprint(mc: MeaningChange): string {
  return meaningDeduplicationFingerprint({
    definition: mc.definition ?? '',
    translations: mc.translations ?? [],
    wordClassId: mc.wordClassId ?? null,
  });
}

/**
 * Tolak add yang dobel di dalam satu payload, sebelum menyentuh database.
 * Dipanggil dari verifyProposedChanges.
 */
export function duplicateAddIssue(meanings: MeaningChange[]): { index: number } | null {
  const seen = new Set<string>();
  for (let index = 0; index < meanings.length; index++) {
    const mc = meanings[index]!;
    if (mc.action !== 'add') continue;
    const fp = addFingerprint(mc);
    if (seen.has(fp)) return { index };
    seen.add(fp);
  }
  return null;
}

/**
 * Rencana apply makna. Update yang menabrak makna lain melempar 409
 * sebelum ada tulisan. Add yang sudah ada ditandai skip.
 */
export function planMeaningApplies(
  rows: ActiveMeaningIdentity[],
  changes: MeaningChange[],
): MeaningApplyPlan {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const skipAddIndexes = new Set<number>();
  const skipped: SkippedDuplicateMeaning[] = [];
  const updateKeys = new Map<string, string | null>();
  const taken = new Map(rows.map((row) => [row.fingerprint, row.id]));

  changes.forEach((mc, index) => {
    if (mc.action === 'add' && !mc.meaningId) {
      const fp = addFingerprint(mc);
      const hit = taken.get(fp);
      if (hit) {
        const row = byId.get(hit);
        skipAddIndexes.add(index);
        skipped.push({
          meaningId: hit,
          definition: row?.definition ?? mc.definition ?? '',
          translationText: gloss(row?.translations ?? mc.translations ?? []),
        });
        return;
      }
      taken.set(fp, `new:${index}`);
      return;
    }

    if (mc.action === 'update' && mc.meaningId) {
      const existing = byId.get(mc.meaningId);
      if (!existing) return;
      const translations = mergedTranslations(existing.translations, mc.translations);
      const nextClass = mc.wordClassId !== undefined ? mc.wordClassId : existing.wordClassId;
      const nextDef = mc.definition !== undefined ? mc.definition : existing.definition;
      const fp = meaningDeduplicationFingerprint({
        definition: nextDef,
        translations,
        wordClassId: nextClass,
      });
      const hit = taken.get(fp);
      if (hit && hit !== existing.id) {
        const row = byId.get(hit);
        throwDuplicateMeaningConflict({
          wordId: '',
          meaningId: hit,
          lemma: '',
          definition: row?.definition ?? nextDef,
          translationText: gloss(row?.translations ?? translations),
        });
      }
      taken.delete(existing.fingerprint);
      taken.set(fp, existing.id);
      updateKeys.set(
        existing.id,
        meaningDedupeKey({
          definition: nextDef,
          translations,
          wordClassId: nextClass,
        }),
      );
    }

    if (mc.action === 'delete' && mc.meaningId) {
      const existing = byId.get(mc.meaningId);
      if (existing) taken.delete(existing.fingerprint);
    }
  });

  return { skipAddIndexes, skipped, updateKeys };
}

export function suggestionHasOtherChanges(changes: ProposedChanges): boolean {
  return (
    changes.wordType !== undefined ||
    changes.lemma !== undefined ||
    changes.notes !== undefined ||
    (changes.categoryIdsToAdd?.length ?? 0) > 0 ||
    (changes.categoryIdsToRemove?.length ?? 0) > 0 ||
    (changes.relations?.length ?? 0) > 0 ||
    (changes.variants?.length ?? 0) > 0 ||
    (changes.images?.length ?? 0) > 0 ||
    (changes.groups?.length ?? 0) > 0 ||
    (changes.meanings ?? []).some((mc) => mc.action === 'delete' || mc.action === 'update')
  );
}

/**
 * Cek sebelum insert usulan. Bentrok = 409, baris usulan tidak dibuat.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertProposedMeaningsUnique(
  tx: any,
  word: { id: string; lemma: string },
  changes: ProposedChanges,
): Promise<void> {
  const meanings = changes.meanings ?? [];
  if (meanings.length === 0) return;
  const rows = await loadActiveMeaningIdentities(tx, word.id);
  let plan: MeaningApplyPlan;
  try {
    plan = planMeaningApplies(rows, meanings);
  } catch (err) {
    if (err instanceof ConflictError && err.errorCode === 'DUPLICATE_MEANING') {
      const data = (err.data ?? {}) as { meaning_id?: string; definition?: string; translation_text?: string };
      throwDuplicateMeaningConflict({
        wordId: word.id,
        meaningId: data.meaning_id ?? '',
        lemma: word.lemma,
        definition: data.definition ?? '',
        translationText: data.translation_text ?? '',
      });
    }
    throw err;
  }
  const onlyDuplicateAdds =
    plan.skipped.length > 0 &&
    plan.skipAddIndexes.size === meanings.filter((mc) => mc.action === 'add').length &&
    !suggestionHasOtherChanges(changes);
  if (onlyDuplicateAdds) {
    const first = plan.skipped[0]!;
    throwDuplicateMeaningConflict({
      wordId: word.id,
      meaningId: first.meaningId,
      lemma: word.lemma,
      definition: first.definition,
      translationText: first.translationText,
    });
  }
}
