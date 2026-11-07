import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDatabase, AppTransaction } from '@/shared/database/drizzle/client';
import {
  activityEvents,
  examples,
  meaningTranslations,
  meaningVoteCounts,
  meanings,
  votes,
  wordEditSuggestions,
  words,
} from '@/shared/database/drizzle/schema';
import type { ProposedChanges } from '@/modules/word-suggestions/domain/entities/word-suggestion.entity';
import type { MeaningIdentityInput } from './utils/meaning-deduplication';
import { meaningDeduplicationFingerprint, meaningDedupeKey } from './utils/meaning-deduplication';

const IN_CHUNK = 400;

export interface MergeMeaningRow {
  id: string;
  wordId: string;
  wordClassId: string | null;
  definition: string;
  createdAt: number;
  voteCount: number;
  translations: { languageId: string; translationText: string }[];
}

export interface SafeMergeGroup {
  wordId: string;
  fingerprint: string;
  winnerId: string;
  loserIds: string[];
  dedupeKey: string | null;
}

export interface MeaningVoteRef {
  userId: string;
  meaningId: string;
  value: number;
}

export interface VoteResolution {
  moves: { userId: string; fromMeaningId: string; toMeaningId: string }[];
  deletes: { userId: string; meaningId: string }[];
}

function identityOf(row: MergeMeaningRow): MeaningIdentityInput {
  return {
    definition: row.definition,
    translations: row.translations,
    wordClassId: row.wordClassId,
  };
}

/**
 * Kelompok aman: sidik sama di satu kata, 2+ baris.
 * Pemenang = createdAt terkecil. Seri: voteCount terbesar, lalu id terkecil.
 */
export function planSafeMeaningMerges(rows: MergeMeaningRow[]): SafeMergeGroup[] {
  const buckets = new Map<string, MergeMeaningRow[]>();
  for (const row of rows) {
    const fp = meaningDeduplicationFingerprint(identityOf(row));
    const key = `${row.wordId}\0${fp}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const groups: SafeMergeGroup[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      if (a.voteCount !== b.voteCount) return b.voteCount - a.voteCount;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const winner = ranked[0]!;
    groups.push({
      wordId: winner.wordId,
      fingerprint: meaningDeduplicationFingerprint(identityOf(winner)),
      winnerId: winner.id,
      loserIds: ranked.slice(1).map((row) => row.id),
      dedupeKey: meaningDedupeKey(identityOf(winner)),
    });
  }
  return groups;
}

/**
 * Satu user satu vote di pemenang. Vote dobel dihapus, tidak dijumlahkan.
 * Vote yang hanya ada di pecundang dipindah sekali.
 */
export function resolveMeaningVotes(input: {
  winnerId: string;
  loserIds: string[];
  votes: MeaningVoteRef[];
}): VoteResolution {
  const losers = new Set(input.loserIds);
  const byUser = new Map<string, MeaningVoteRef[]>();
  for (const vote of input.votes) {
    if (vote.meaningId !== input.winnerId && !losers.has(vote.meaningId)) continue;
    const list = byUser.get(vote.userId) ?? [];
    list.push(vote);
    byUser.set(vote.userId, list);
  }

  const moves: VoteResolution['moves'] = [];
  const deletes: VoteResolution['deletes'] = [];
  for (const [userId, list] of byUser) {
    const onWinner = list.some((vote) => vote.meaningId === input.winnerId);
    const onLosers = list.filter((vote) => losers.has(vote.meaningId));
    if (onWinner) {
      for (const vote of onLosers) deletes.push({ userId, meaningId: vote.meaningId });
      continue;
    }
    if (onLosers.length === 0) continue;
    const [keep, ...rest] = onLosers;
    moves.push({ userId, fromMeaningId: keep!.meaningId, toMeaningId: input.winnerId });
    for (const vote of rest) deletes.push({ userId, meaningId: vote.meaningId });
  }
  return { moves, deletes };
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function suggestionOnlyAddsDuplicates(changes: ProposedChanges): boolean {
  const meanings = changes.meanings ?? [];
  if (meanings.length === 0) return false;
  if (meanings.some((mc) => mc.action !== 'add')) return false;
  return (
    changes.wordType === undefined &&
    changes.lemma === undefined &&
    changes.notes === undefined &&
    (changes.categoryIdsToAdd?.length ?? 0) === 0 &&
    (changes.categoryIdsToRemove?.length ?? 0) === 0 &&
    (changes.relations?.length ?? 0) === 0 &&
    (changes.variants?.length ?? 0) === 0 &&
    (changes.images?.length ?? 0) === 0 &&
    (changes.groups?.length ?? 0) === 0
  );
}

/**
 * Gabung kelompok aman yang sudah ada, lalu isi dedupe_key.
 * Bukan jalur request. Panggil sekali setelah migrasi 0116.
 * Event aktivitas tidak ditulis ulang. Usulan pending yang hanya
 * menambah duplikat ditutup dan event usulannya disembunyikan.
 */
export async function applySafeMeaningMerges(
  db: AppDatabase,
): Promise<{ groups: number; closedSuggestions: number }> {
  return db.transaction((tx) => applySafeMeaningMergesTx(tx));
}

async function loadRowsByIds<T>(
  ids: string[],
  load: (slice: string[]) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (const slice of chunks(ids, IN_CHUNK)) {
    rows.push(...(await load(slice)));
  }
  return rows;
}

/** Baris aktif untuk rencana gabung. Dipakai dry-run dan apply. */
export async function loadMergeMeaningRows(
  db: AppDatabase | AppTransaction,
): Promise<Array<MergeMeaningRow & { lemma: string }>> {
  const meaningRows = await db
    .select({
      id: meanings.id,
      wordId: meanings.wordId,
      lemma: words.lemma,
      wordClassId: meanings.wordClassId,
      definition: meanings.definition,
      createdAt: meanings.createdAt,
    })
    .from(meanings)
    .innerJoin(words, eq(words.id, meanings.wordId))
    .where(isNull(meanings.deletedAt));

  if (meaningRows.length === 0) return [];

  const ids = meaningRows.map((row) => row.id);
  const translationRows = await loadRowsByIds(ids, (slice) =>
    db
      .select({
        meaningId: meaningTranslations.meaningId,
        languageId: meaningTranslations.languageId,
        translationText: meaningTranslations.translationText,
      })
      .from(meaningTranslations)
      .where(and(inArray(meaningTranslations.meaningId, slice), isNull(meaningTranslations.deletedAt))),
  );
  const countRows = await loadRowsByIds(ids, (slice) =>
    db
      .select({ meaningId: meaningVoteCounts.meaningId, total: meaningVoteCounts.total })
      .from(meaningVoteCounts)
      .where(inArray(meaningVoteCounts.meaningId, slice)),
  );

  const trBy = new Map<string, { languageId: string; translationText: string }[]>();
  for (const t of translationRows) {
    const list = trBy.get(t.meaningId) ?? [];
    list.push({ languageId: t.languageId, translationText: t.translationText });
    trBy.set(t.meaningId, list);
  }
  const votesBy = new Map(countRows.map((row) => [row.meaningId, row.total]));

  return meaningRows.map((row) => ({
    id: row.id,
    wordId: row.wordId,
    lemma: row.lemma,
    wordClassId: row.wordClassId,
    definition: row.definition,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
    voteCount: votesBy.get(row.id) ?? 0,
    translations: trBy.get(row.id) ?? [],
  }));
}

async function applySafeMeaningMergesTx(
  db: AppTransaction,
): Promise<{ groups: number; closedSuggestions: number }> {
  const meaningRows = await loadMergeMeaningRows(db);
  if (meaningRows.length === 0) return { groups: 0, closedSuggestions: 0 };

  const trBy = new Map(meaningRows.map((row) => [row.id, row.translations]));
  const planned = planSafeMeaningMerges(meaningRows);

  const loserToWinner = new Map<string, string>();
  for (const group of planned) {
    for (const loserId of group.loserIds) loserToWinner.set(loserId, group.winnerId);
    if (group.loserIds.length === 0) continue;

    await db
      .update(examples)
      .set({ meaningId: group.winnerId })
      .where(inArray(examples.meaningId, group.loserIds));
    await db
      .update(meanings)
      .set({ inheritedFromMeaningId: group.winnerId })
      .where(inArray(meanings.inheritedFromMeaningId, group.loserIds));

    const voteRows = await db
      .select({ userId: votes.userId, meaningId: votes.entityId, value: votes.value })
      .from(votes)
      .where(
        and(
          eq(votes.entityType, 'meaning'),
          inArray(votes.entityId, [group.winnerId, ...group.loserIds]),
        ),
      );
    const resolution = resolveMeaningVotes({
      winnerId: group.winnerId,
      loserIds: group.loserIds,
      votes: voteRows,
    });
    for (const del of resolution.deletes) {
      await db
        .delete(votes)
        .where(
          and(eq(votes.userId, del.userId), eq(votes.entityType, 'meaning'), eq(votes.entityId, del.meaningId)),
        );
    }
    for (const move of resolution.moves) {
      await db
        .update(votes)
        .set({ entityId: move.toMeaningId })
        .where(
          and(
            eq(votes.userId, move.userId),
            eq(votes.entityType, 'meaning'),
            eq(votes.entityId, move.fromMeaningId),
          ),
        );
    }

    const [counted] = await db
      .select({ total: sql<number>`count(*)` })
      .from(votes)
      .where(and(eq(votes.entityType, 'meaning'), eq(votes.entityId, group.winnerId)));
    await db.delete(meaningVoteCounts).where(inArray(meaningVoteCounts.meaningId, group.loserIds));
    await db
      .insert(meaningVoteCounts)
      .values({ meaningId: group.winnerId, total: Number(counted?.total ?? 0) })
      .onConflictDoUpdate({
        target: meaningVoteCounts.meaningId,
        set: { total: Number(counted?.total ?? 0), updatedAt: new Date() },
      });

    await db
      .update(meanings)
      .set({ deletedAt: new Date(), dedupeKey: null })
      .where(inArray(meanings.id, group.loserIds));
    await db
      .update(meanings)
      .set({ dedupeKey: group.dedupeKey })
      .where(eq(meanings.id, group.winnerId));
  }

  const survivors = await db
    .select({
      id: meanings.id,
      wordClassId: meanings.wordClassId,
      definition: meanings.definition,
    })
    .from(meanings)
    .where(and(isNull(meanings.deletedAt), isNull(meanings.dedupeKey)));
  for (const row of survivors) {
    const key = meaningDedupeKey({
      definition: row.definition,
      translations: trBy.get(row.id) ?? [],
      wordClassId: row.wordClassId,
    });
    if (!key) continue;
    await db.update(meanings).set({ dedupeKey: key }).where(eq(meanings.id, row.id));
  }

  const liveByWord = new Map<string, Set<string>>();
  for (const row of meaningRows) {
    if (loserToWinner.has(row.id)) continue;
    const fp = meaningDeduplicationFingerprint({
      definition: row.definition,
      translations: trBy.get(row.id) ?? [],
      wordClassId: row.wordClassId,
    });
    const set = liveByWord.get(row.wordId) ?? new Set<string>();
    set.add(fp);
    liveByWord.set(row.wordId, set);
  }

  let closedSuggestions = 0;
  const pending = await db
    .select({
      id: wordEditSuggestions.id,
      wordId: wordEditSuggestions.wordId,
      proposedChanges: wordEditSuggestions.proposedChanges,
    })
    .from(wordEditSuggestions)
    .where(and(eq(wordEditSuggestions.status, 'pending'), isNull(wordEditSuggestions.deletedAt)));
  for (const suggestion of pending) {
    const changes = structuredClone(suggestion.proposedChanges) as ProposedChanges;
    let touched = false;
    for (const mc of changes.meanings ?? []) {
      if (mc.meaningId && loserToWinner.has(mc.meaningId)) {
        mc.meaningId = loserToWinner.get(mc.meaningId);
        touched = true;
      }
    }
    if (touched) {
      await db
        .update(wordEditSuggestions)
        .set({ proposedChanges: changes, updatedAt: new Date() })
        .where(eq(wordEditSuggestions.id, suggestion.id));
    }
    if (!suggestionOnlyAddsDuplicates(changes)) continue;
    const live = liveByWord.get(suggestion.wordId) ?? new Set<string>();
    const allDup = (changes.meanings ?? []).every((mc) =>
      live.has(
        meaningDeduplicationFingerprint({
          definition: mc.definition ?? '',
          translations: (mc.translations ?? []).map((t) => ({
            languageId: t.languageId,
            translationText: t.translationText,
          })),
          wordClassId: mc.wordClassId ?? null,
        }),
      ),
    );
    if (!allDup) continue;
    await db
      .update(wordEditSuggestions)
      .set({
        status: 'rejected',
        reviewComment: 'Makna yang sama sudah ada.',
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wordEditSuggestions.id, suggestion.id));
    await db
      .update(activityEvents)
      .set({ hiddenAt: new Date() })
      .where(eq(activityEvents.dedupeKey, `suggestion:${suggestion.id}`));
    closedSuggestions++;
  }

  return { groups: planned.length, closedSuggestions };
}

