/** Shared helpers for word-suggestion repository. */
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { meanings, meaningTranslations, examples, pronunciations } from '@/shared/database/drizzle/schema';
export async function captureBaseline(
  wordId: string,
  lemma: string,
  notes: string | null,
  isVerified: boolean,
  wordType: string,
) {
  const meaningRows = await db
    .select({ id: meanings.id, definition: meanings.definition, wordClassId: meanings.wordClassId })
    .from(meanings)
    .where(and(eq(meanings.wordId, wordId), isNull(meanings.deletedAt)));
  const meaningIds = meaningRows.map((m) => m.id);
  const translationRows = meaningIds.length
    ? await db
        .select({
          id: meaningTranslations.id,
          meaningId: meaningTranslations.meaningId,
          translationText: meaningTranslations.translationText,
        })
        .from(meaningTranslations)
        .where(and(inArray(meaningTranslations.meaningId, meaningIds), isNull(meaningTranslations.deletedAt)))
    : [];
  const exampleRows = meaningIds.length
    ? await db
        .select({
          id: examples.id,
          sourceSentence: examples.sourceSentence,
          targetSentence: examples.targetSentence,
        })
        .from(examples)
        .where(and(inArray(examples.meaningId, meaningIds), isNull(examples.deletedAt)))
    : [];
  const pronunciationRows = await db
    .select({
      id: pronunciations.id,
      value: pronunciations.value,
    })
    .from(pronunciations)
    .where(and(eq(pronunciations.wordId, wordId), isNull(pronunciations.deletedAt)));
  return {
    lemma,
    notes,
    wordType,
    isVerified,
    meanings: meaningRows.map((m) => ({
      id: m.id,
      definition: m.definition,
      wordClassId: m.wordClassId as string | null | undefined,
      translations: translationRows
        .filter((t) => t.meaningId === m.id)
        .map((t) => ({ id: t.id, translationText: t.translationText })),
    })),
    examples: exampleRows.map((ex) => ({
      id: ex.id,
      sourceSentence: ex.sourceSentence,
      targetSentence: ex.targetSentence,
    })),
    pronunciations: pronunciationRows.map((p) => ({
      id: p.id,
      value: p.value,
    })),
  };
}

