import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  lemmaMergeRequests,
  wordEditSuggestions,
  words,
} from '@/shared/database/drizzle/schema';
import { BadRequestError, ConflictError } from '@/shared/errors/app-error';

export async function assertLemmaMergeBatchAllowed(
  db: AppDatabase,
  keepWordId: string,
  mergeWordIds: string[],
  opts?: { requirePublishedKeep?: boolean },
): Promise<{ keepLemma: string; mergeLemmas: string[] }> {
  const mergeIds = [...new Set(mergeWordIds.filter((id) => id !== keepWordId))];
  if (mergeIds.length === 0) {
    throw new BadRequestError('VALIDATION_ERROR', 'Pilih minimal satu entri selain penjaga');
  }
  const allIds = [keepWordId, ...mergeIds];

  const rows = await db
    .select({
      id: words.id,
      lemma: words.lemma,
      languageId: words.languageId,
      wordType: words.wordType,
      status: words.status,
    })
    .from(words)
    .where(and(inArray(words.id, allIds), isNull(words.deletedAt)));

  if (rows.length !== allIds.length) {
    throw new BadRequestError('WORD_NOT_FOUND', 'Salah satu entri tidak ditemukan atau sudah dihapus');
  }

  const keep = rows.find((r) => r.id === keepWordId);
  if (!keep) {
    throw new BadRequestError('WORD_NOT_FOUND', 'Entri penjaga tidak ditemukan');
  }
  if (keep.status === 'taken_down') {
    throw new BadRequestError('WORD_UNAVAILABLE', 'Entri penjaga tidak bisa dipakai');
  }
  if (opts?.requirePublishedKeep && keep.status !== 'published') {
    throw new BadRequestError('WORD_NOT_PUBLISHED', 'Entri utama harus sudah tayang');
  }

  for (const r of rows) {
    if (r.id === keepWordId) continue;
    if (r.languageId !== keep.languageId) {
      throw new BadRequestError('WORD_MERGE_LANGUAGE_MISMATCH', 'Semua entri harus satu bahasa');
    }
    if (r.wordType !== keep.wordType) {
      throw new BadRequestError('WORD_MERGE_TYPE_MISMATCH', 'Jenis entri harus sama');
    }
    if (r.status === 'taken_down') {
      throw new BadRequestError('WORD_UNAVAILABLE', `Entri "${r.lemma}" tidak bisa digabung`);
    }
  }

  const pendingSug = await db
    .select({ id: wordEditSuggestions.id })
    .from(wordEditSuggestions)
    .where(
      and(
        inArray(wordEditSuggestions.wordId, allIds),
        eq(wordEditSuggestions.status, 'pending'),
        isNull(wordEditSuggestions.deletedAt),
      ),
    )
    .limit(1);
  if (pendingSug.length > 0) {
    throw new ConflictError(
      'MERGE_BLOCKED_PENDING_SUGGESTION',
      'Ada usulan edit yang masih ditinjau. Selesaikan dulu sebelum gabung.',
    );
  }

  const pendingMerge = await db
    .select({
      keepWordId: lemmaMergeRequests.keepWordId,
      mergeWordIds: lemmaMergeRequests.mergeWordIds,
    })
    .from(lemmaMergeRequests)
    .where(eq(lemmaMergeRequests.status, 'pending'))
    .limit(200);
  for (const row of pendingMerge) {
    const ids = new Set([row.keepWordId, ...(row.mergeWordIds ?? [])]);
    if (allIds.some((id) => ids.has(id))) {
      throw new ConflictError(
        'MERGE_ALREADY_PENDING',
        'Salah satu entri sedang dalam usulan gabung lain.',
      );
    }
  }

  for (const r of rows) {
    if (r.id === keepWordId) continue;
    const lemma = r.lemma.trim();
    const [conflict] = await db
      .select({ id: words.id })
      .from(words)
      .where(
        and(
          eq(sql`lower(trim(${words.lemma}))`, lemma.toLowerCase()),
          eq(words.languageId, keep.languageId),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
          notInArray(words.id, allIds),
        ),
      )
      .limit(1);
    if (conflict) {
      throw new ConflictError(
        'WORD_MERGE_LEMMA_CONFLICT',
        `Lemma "${lemma}" masih dipakai entri lain di luar pilihanmu.`,
      );
    }
  }

  return {
    keepLemma: keep.lemma,
    mergeLemmas: rows.filter((r) => r.id !== keepWordId).map((r) => r.lemma),
  };
}