/**
 * Backfill activity_events dari tabel sumber (#86).
 *
 * Satu kali dijalankan setelah migrasi 0061: memindahkan sejarah aksi
 * publik yang layak tayang ke event log, dengan occurredAt = momen kejadian
 * asli (bukan waktu backfill). Idempoten lewat dedupe_key.
 *
 * Jalankan: npm run db:backfill-activity
 * (DATABASE_URL harus menunjuk DB target).
 */
import 'dotenv/config';
import { and, eq, inArray, isNull } from 'drizzle-orm';

// Import client SETELAH dotenv load (client -> env.ts validasi CORS dsb);
// static import di-hoist sebelum .env terbaca.
const { db, closeDb } = await import('../shared/database/drizzle/client');
const {
  activityEvents,
  comments,
  contributions,
  contributionReviews,
  searchMisses,
  users,
  votes,
  wordEditSuggestions,
  words,
} = await import('../shared/database/drizzle/schema');
import type { ActivityEventKind } from '../modules/activity/domain/entities/activity-event.entity';

interface Row {
  kind: ActivityEventKind;
  actorId: string | null;
  targetWordId: string | null;
  targetId: string | null;
  occurredAt: Date;
  dedupeKey: string;
}

async function insertAll(rows: Row[]): Promise<number> {
  let n = 0;
  // chunk 500: sqlite batas variabel bind
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await db
      .insert(activityEvents)
      .values(chunk)
      .onConflictDoNothing({ target: activityEvents.dedupeKey })
      .returning({ id: activityEvents.id });
    n += res.length;
  }
  return n;
}

const CONTRIBUTION_KIND: Record<string, ActivityEventKind> = {
  word: 'word_created',
  word_image: 'contribution_image',
  word_audio: 'contribution_audio',
  pronunciation: 'contribution_pron',
  example: 'contribution_example',
};

/** wordId induk kontribusi anak (copy resolveContributionWordId repo). */
async function resolveParentWordIds(
  entityType: string,
  entityIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (entityIds.length === 0) return out;
  const s = await import('../shared/database/drizzle/schema');
  if (entityType === 'word_image') {
    const rows = await db
      .select({ id: s.wordImages.id, wordId: s.wordImages.wordId })
      .from(s.wordImages)
      .where(inArray(s.wordImages.id, entityIds));
    for (const r of rows) if (r.wordId) out.set(r.id, r.wordId);
  } else if (entityType === 'word_audio') {
    const rows = await db
      .select({ id: s.wordAudios.id, wordId: s.wordAudios.wordId })
      .from(s.wordAudios)
      .where(inArray(s.wordAudios.id, entityIds));
    for (const r of rows) if (r.wordId) out.set(r.id, r.wordId);
  } else if (entityType === 'pronunciation') {
    const rows = await db
      .select({ id: s.pronunciations.id, wordId: s.pronunciations.wordId })
      .from(s.pronunciations)
      .where(inArray(s.pronunciations.id, entityIds));
    for (const r of rows) if (r.wordId) out.set(r.id, r.wordId);
  } else if (entityType === 'example') {
    const rows = await db
      .select({ id: s.examples.id, meaningId: s.examples.meaningId })
      .from(s.examples)
      .where(inArray(s.examples.id, entityIds));
    const meaningIds = rows.map((r) => r.meaningId).filter((m): m is string => !!m);
    const wordRows = meaningIds.length
      ? await db
          .select({ id: s.meanings.id, wordId: s.meanings.wordId })
          .from(s.meanings)
          .where(inArray(s.meanings.id, meaningIds))
      : [];
    const meaningToWord = new Map(wordRows.map((r) => [r.id, r.wordId]));
    for (const r of rows) {
      const w = r.meaningId ? meaningToWord.get(r.meaningId) : undefined;
      if (w) out.set(r.id, w);
    }
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib di-set');
  console.log('[backfill-activity] mulai');

  // 1. Kontribusi approved (kontributor) - contribution_* + word_created
  const contribRows = await db
    .select({
      id: contributions.id,
      userId: contributions.userId,
      entityType: contributions.entityType,
      entityId: contributions.entityId,
      createdAt: contributions.createdAt,
    })
    .from(contributions)
    .where(
      and(
        inArray(contributions.status, ['approved', 'corrected']),
        isNull(contributions.deletedAt),
      ),
    );
  const contribEvents: Row[] = [];
  for (const r of contribRows) {
    const kind = CONTRIBUTION_KIND[r.entityType];
    if (!kind) continue;
    let targetWordId: string | null = null;
    if (r.entityType !== 'word') {
      const parents = await resolveParentWordIds(r.entityType, [r.entityId]);
      targetWordId = parents.get(r.entityId) ?? null;
    } else {
      targetWordId = r.entityId;
    }
    contribEvents.push({
      kind,
      actorId: r.userId,
      targetWordId,
      targetId: r.entityId,
      occurredAt: r.createdAt,
      dedupeKey: `contribution:${r.entityType}:${r.entityId}`,
    });
  }
  const n1 = await insertAll(contribEvents);
  console.log(`[backfill-activity] kontribusi: ${n1}`);

  // 2. Kata published (word_created oleh pembuat; dedupe per kata).
  // Kata hasil kontribusi approved di-skip - section 1 sudah emit word_created
  // untuk mereka (key beda = dobel baris feed).
  const contribWordIds = new Set(
    contribRows.filter((r) => r.entityType === 'word').map((r) => r.entityId),
  );
  const wordRows = await db
    .select({
      id: words.id,
      createdBy: words.createdBy,
      createdAt: words.createdAt,
    })
    .from(words)
    .where(and(eq(words.status, 'published'), isNull(words.deletedAt)));
  const n2 = await insertAll(
    wordRows
      .filter((r) => r.createdBy && !contribWordIds.has(r.id))
      .map((r) => ({
        kind: 'word_created' as const,
        actorId: r.createdBy,
        targetWordId: r.id,
        targetId: r.id,
        occurredAt: r.createdAt,
        dedupeKey: `word:${r.id}`,
      })),
  );
  console.log(`[backfill-activity] kata: ${n2}`);

  // 3. Komentar published
  const commentRows = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      wordId: comments.wordId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.status, 'published'), isNull(comments.deletedAt)));
  const n3 = await insertAll(
    commentRows.map((r) => ({
      kind: 'comment_created' as const,
      actorId: r.userId,
      targetWordId: r.wordId,
      targetId: r.id,
      occurredAt: r.createdAt,
      dedupeKey: `comment:${r.id}`,
    })),
  );
  console.log(`[backfill-activity] komentar: ${n3}`);

  // 4. Vote aktif (word + comment)
  const voteRows = await db
    .select({
      id: votes.id,
      userId: votes.userId,
      entityType: votes.entityType,
      entityId: votes.entityId,
      createdAt: votes.createdAt,
    })
    .from(votes)
    .where(inArray(votes.entityType, ['word', 'comment']));
  const voteEvents: Row[] = [];
  for (const r of voteRows) {
    let targetWordId: string | null = null;
    if (r.entityType === 'word') {
      targetWordId = r.entityId;
    } else {
      const [c] = await db
        .select({ wordId: comments.wordId })
        .from(comments)
        .where(eq(comments.id, r.entityId))
        .limit(1);
      targetWordId = c?.wordId ?? null;
    }
    voteEvents.push({
      kind: r.entityType === 'word' ? 'vote_word' : 'vote_comment',
      actorId: r.userId,
      targetWordId,
      targetId: r.entityId,
      occurredAt: r.createdAt,
      dedupeKey: `vote:${r.userId}:${r.entityType}:${r.entityId}`,
    });
  }
  const n4 = await insertAll(voteEvents);
  console.log(`[backfill-activity] vote: ${n4}`);

  // 5. Verifikasi kontribusi (reviewer; word_verified dipisah - #85).
  // dedupeKey = word_verified:{wordId} (sama dengan emitter) - satu baris
  // verifikasi per kata, reviewer pertama menang (onConflictDoNothing).
  const reviewRows = await db
    .select({
      id: contributionReviews.id,
      reviewerId: contributionReviews.reviewerId,
      entityType: contributions.entityType,
      entityId: contributions.entityId,
      createdAt: contributionReviews.createdAt,
    })
    .from(contributionReviews)
    .innerJoin(contributions, eq(contributionReviews.contributionId, contributions.id))
    .where(
      and(
        inArray(contributionReviews.status, ['approved', 'corrected']),
        isNull(contributionReviews.deletedAt),
        eq(contributions.entityType, 'word'),
      ),
    );
  const n5 = await insertAll(
    reviewRows
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({
        kind: 'word_verified' as const,
        actorId: r.reviewerId,
        targetWordId: r.entityId,
        targetId: r.entityId,
        occurredAt: r.createdAt,
        dedupeKey: `word_verified:${r.entityId}`,
      })),
  );
  console.log(`[backfill-activity] verifikasi kontribusi: ${n5}`);

  // 5b. Usulan kata baru masih pending (contribution_submitted; rejected =
  // tidak tayang, approved = word_created di section 1).
  const pendingWordRows = await db
    .select({
      entityId: contributions.entityId,
      userId: contributions.userId,
      createdAt: contributions.createdAt,
    })
    .from(contributions)
    .where(
      and(
        eq(contributions.entityType, 'word'),
        eq(contributions.status, 'pending'),
        isNull(contributions.deletedAt),
      ),
    );
  const n5b = await insertAll(
    pendingWordRows.map((r) => ({
      kind: 'contribution_submitted' as const,
      actorId: r.userId,
      targetWordId: r.entityId,
      targetId: r.entityId,
      occurredAt: r.createdAt,
      dedupeKey: `contribution:${r.entityId}`,
    })),
  );
  console.log(`[backfill-activity] usulan kata pending: ${n5b}`);

  // 6. Usulan edit diterapkan (pengusul)
  const suggRows = await db
    .select({
      id: wordEditSuggestions.id,
      userId: wordEditSuggestions.userId,
      wordId: wordEditSuggestions.wordId,
      appliedAt: wordEditSuggestions.reviewedAt,
    })
    .from(wordEditSuggestions)
    .where(
      and(
        inArray(wordEditSuggestions.status, ['approved', 'correct_and_publish']),
        isNull(wordEditSuggestions.deletedAt),
      ),
    );
  const n6 = await insertAll(
    suggRows
      .filter((r) => r.appliedAt)
      .map((r) => ({
        kind: 'suggestion_applied' as const,
        actorId: r.userId,
        targetWordId: r.wordId,
        targetId: r.id,
        occurredAt: r.appliedAt!,
        dedupeKey: `suggestion:${r.id}`,
      })),
  );
  console.log(`[backfill-activity] usulan diterapkan: ${n6}`);

  // 7. Join user (emailVerifiedAt; hanya yang verified)
  const joinedRows = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(and(eq(users.emailVerified, true), isNull(users.deletedAt)));
  const n7 = await insertAll(
    joinedRows
      .filter((r) => r.emailVerifiedAt)
      .map((r) => ({
        kind: 'user_joined' as const,
        actorId: r.id,
        targetWordId: null,
        targetId: r.id,
        occurredAt: r.emailVerifiedAt!,
        dedupeKey: `joined:${r.id}`,
      })),
  );
  console.log(`[backfill-activity] join: ${n7}`);

  // 8. Search-miss visible (actor null)
  const missRows = await db
    .select({ id: searchMisses.id, createdAt: searchMisses.createdAt })
    .from(searchMisses)
    .where(eq(searchMisses.isVisible, true));
  const n8 = await insertAll(
    missRows.map((r) => ({
      kind: 'search_miss' as const,
      actorId: null,
      targetWordId: null,
      targetId: r.id,
      occurredAt: r.createdAt,
      dedupeKey: `search_miss:${r.id}`,
    })),
  );
  console.log(`[backfill-activity] search-miss: ${n8}`);

  const total = n1 + n2 + n3 + n4 + n5 + n5b + n6 + n7 + n8;
  console.log(`[backfill-activity] selesai: ${total} event baru`);
  await closeDb();
}

main().catch(async (err) => {
  console.error('[backfill-activity] gagal:', err);
  await closeDb();
  process.exit(1);
});
