import { alias } from 'drizzle-orm/sqlite-core';
import { and, desc, eq, like, lt, or, sql, isNull, inArray } from 'drizzle-orm';
import {
  examples,
  languages,
  meanings,
  users,
  wordImportSessions,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  ClaimWordImportSessionInput,
  NewWordImportSession,
  WordImportSession,
  WordImportSessionItem,
  WordImportSessionStatus,
  WordImportSupportType,
} from '../domain/entities/word-import-session.entity';
import type { WordImportSessionRepository } from '../domain/repositories/word-import-session.repository';

type Row = typeof wordImportSessions.$inferSelect;

const triggeredUsers = alias(users, 'import_triggered_by');
const attributedUsers = alias(users, 'import_attributed_to');
const claimedUsers = alias(users, 'import_claimed_by');

function parseItems(raw: string): WordImportSessionItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        lemma: String(row.lemma ?? ''),
        outcome: (row.outcome as WordImportSessionItem['outcome']) ?? 'invalid',
        meanings_added: Number(row.meanings_added ?? 0),
        message: typeof row.message === 'string' ? row.message : undefined,
        word_id: typeof row.word_id === 'string' ? row.word_id : undefined,
      };
    });
  } catch {
    return [];
  }
}

function toSupportType(raw: string | null): WordImportSupportType | null {
  if (raw === 'web' || raw === 'book' || raw === 'article' || raw === 'other') return raw;
  return null;
}

function displayName(display: string | null, username: string | null): string | null {
  const trimmed = display?.trim() || null;
  return trimmed || username;
}

function toEntity(
  row: Row,
  triggeredByUsername: string | null,
  triggeredByDisplayName: string | null,
  attributedToUsername: string | null,
  attributedToDisplayName: string | null,
  claimedByUsername: string | null,
  claimedByDisplayName: string | null,
): WordImportSession {
  return {
    id: row.id,
    triggeredBy: row.triggeredBy,
    triggeredByUsername,
    triggeredByDisplayName: displayName(triggeredByDisplayName, triggeredByUsername),
    attributedTo: row.attributedTo,
    attributedToUsername,
    attributedToDisplayName: displayName(attributedToDisplayName, attributedToUsername),
    sourceLabel: row.sourceLabel,
    supportName: row.supportName,
    supportType: toSupportType(row.supportType),
    supportAddress: row.supportAddress,
    supportTitle: row.supportTitle,
    supportDesc: row.supportDesc,
    claimedBy: row.claimedBy,
    claimedByUsername,
    claimedByDisplayName: displayName(claimedByDisplayName, claimedByUsername),
    claimedAt: row.claimedAt,
    status: row.status as WordImportSessionStatus,
    total: row.total,
    createdCount: row.createdCount,
    duplicatesCount: row.duplicatesCount,
    meaningsAddedCount: row.meaningsAddedCount,
    invalidCount: row.invalidCount,
    items: parseItems(row.itemsJson),
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    rolledBackAt: row.rolledBackAt ?? null,
    rolledBackBy: row.rolledBackBy ?? null,
  };
}

/** Buang wildcard LIKE agar q user tidak jadi pola liar. */
function sanitizeLike(value: string): string {
  return value.replace(/[%_]/g, '');
}

function uniqueLowerLemmas(lemmas: string[]): string[] {
  const seen = new Set<string>();
  for (const lemma of lemmas) {
    const key = lemma.trim().toLowerCase();
    if (key) seen.add(key);
  }
  return [...seen];
}

function lemmaInList(column: typeof words.lemma, lemmas: string[]) {
  return sql`lower(${column}) in (${sql.join(
    lemmas.map((lemma) => sql`${lemma}`),
    sql`, `,
  )})`;
}

export class WordImportSessionRepositoryImpl implements WordImportSessionRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(session: NewWordImportSession): Promise<WordImportSession> {
    // null = masih running; undefined di NewWordImportSession jarang - treat sebagai now untuk final.
    const finishedAt = session.finishedAt === undefined ? new Date() : session.finishedAt;
    const itemsJson = JSON.stringify(session.items);
    const supportName = session.supportName ?? null;
    const supportType = session.supportType ?? null;
    const supportAddress = session.supportAddress ?? null;
    const supportTitle = session.supportTitle ?? null;
    const supportDesc = session.supportDesc ?? null;
    await this.db
      .insert(wordImportSessions)
      .values({
        id: session.id,
        triggeredBy: session.triggeredBy,
        attributedTo: session.attributedTo,
        sourceLabel: session.sourceLabel ?? null,
        supportName,
        supportType,
        supportAddress,
        supportTitle,
        supportDesc,
        status: session.status,
        total: session.total,
        createdCount: session.createdCount,
        duplicatesCount: session.duplicatesCount,
        meaningsAddedCount: session.meaningsAddedCount,
        invalidCount: session.invalidCount,
        itemsJson,
        finishedAt,
      })
      .onConflictDoUpdate({
        target: wordImportSessions.id,
        set: {
          attributedTo: session.attributedTo,
          status: session.status,
          total: session.total,
          createdCount: session.createdCount,
          duplicatesCount: session.duplicatesCount,
          meaningsAddedCount: session.meaningsAddedCount,
          invalidCount: session.invalidCount,
          itemsJson,
          sourceLabel: session.sourceLabel ?? null,
          supportName,
          supportType,
          supportAddress,
          supportTitle,
          supportDesc,
          finishedAt,
        },
      });
    const found = await this.findById(session.id);
    if (!found) throw new Error('Import session hilang setelah upsert');
    return found;
  }

  async findById(id: string): Promise<WordImportSession | null> {
    const [row] = await this.db
      .select({
        session: wordImportSessions,
        triggeredByUsername: triggeredUsers.username,
        triggeredByDisplayName: triggeredUsers.displayName,
        attributedToUsername: attributedUsers.username,
        attributedToDisplayName: attributedUsers.displayName,
        claimedByUsername: claimedUsers.username,
        claimedByDisplayName: claimedUsers.displayName,
      })
      .from(wordImportSessions)
      .leftJoin(triggeredUsers, eq(wordImportSessions.triggeredBy, triggeredUsers.id))
      .leftJoin(attributedUsers, eq(wordImportSessions.attributedTo, attributedUsers.id))
      .leftJoin(claimedUsers, eq(wordImportSessions.claimedBy, claimedUsers.id))
      .where(eq(wordImportSessions.id, id))
      .limit(1);
    if (!row) return null;
    return toEntity(
      row.session,
      row.triggeredByUsername,
      row.triggeredByDisplayName,
      row.attributedToUsername,
      row.attributedToDisplayName,
      row.claimedByUsername,
      row.claimedByDisplayName,
    );
  }

  async list(filter: { limit: number; cursor?: string; q?: string }): Promise<CursorPage<WordImportSession>> {
    const q = sanitizeLike(filter.q?.trim() ?? '');
    const search = q
      ? or(
          like(wordImportSessions.supportName, `%${q}%`),
          like(wordImportSessions.supportTitle, `%${q}%`),
          like(wordImportSessions.supportAddress, `%${q}%`),
          like(wordImportSessions.sourceLabel, `%${q}%`),
        )
      : undefined;
    const cursorWhere = filter.cursor ? lt(wordImportSessions.id, filter.cursor) : undefined;
    const where =
      search && cursorWhere ? and(search, cursorWhere) : search ?? cursorWhere ?? undefined;

    const rows = await this.db
      .select({
        session: wordImportSessions,
        triggeredByUsername: triggeredUsers.username,
        triggeredByDisplayName: triggeredUsers.displayName,
        attributedToUsername: attributedUsers.username,
        attributedToDisplayName: attributedUsers.displayName,
        claimedByUsername: claimedUsers.username,
        claimedByDisplayName: claimedUsers.displayName,
      })
      .from(wordImportSessions)
      .leftJoin(triggeredUsers, eq(wordImportSessions.triggeredBy, triggeredUsers.id))
      .leftJoin(attributedUsers, eq(wordImportSessions.attributedTo, attributedUsers.id))
      .leftJoin(claimedUsers, eq(wordImportSessions.claimedBy, claimedUsers.id))
      .where(where)
      .orderBy(desc(wordImportSessions.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = (hasMore ? rows.slice(0, filter.limit) : rows).map((row) =>
      toEntity(
        row.session,
        row.triggeredByUsername,
        row.triggeredByDisplayName,
        row.attributedToUsername,
        row.attributedToDisplayName,
        row.claimedByUsername,
        row.claimedByDisplayName,
      ),
    );
    return {
      items: page,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async claim(input: ClaimWordImportSessionInput): Promise<WordImportSession> {
    const createdLemmas = uniqueLowerLemmas(input.createdLemmas);
    const meaningLemmas = uniqueLowerLemmas([...input.createdLemmas, ...input.meaningLemmas]);
    const claimedAt = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(wordImportSessions)
        .set({
          attributedTo: input.toUserId,
          claimedBy: input.claimedBy,
          claimedAt,
        })
        .where(eq(wordImportSessions.id, input.sessionId));

      const [sbs] = await tx
        .select({ id: languages.id })
        .from(languages)
        .where(sql`upper(${languages.code}) = 'SBS'`)
        .limit(1);
      if (!sbs) return;

      if (createdLemmas.length > 0) {
        await tx
          .update(words)
          .set({ createdBy: input.toUserId })
          .where(
            and(
              eq(words.languageId, sbs.id),
              eq(words.createdBy, input.fromUserId),
              isNull(words.deletedAt),
              lemmaInList(words.lemma, createdLemmas),
            ),
          );
      }

      if (meaningLemmas.length > 0) {
        const wordIdSubquery = tx
          .select({ id: words.id })
          .from(words)
          .where(
            and(
              eq(words.languageId, sbs.id),
              isNull(words.deletedAt),
              lemmaInList(words.lemma, meaningLemmas),
            ),
          );

        await tx
          .update(meanings)
          .set({ createdBy: input.toUserId })
          .where(
            and(
              eq(meanings.createdBy, input.fromUserId),
              isNull(meanings.deletedAt),
              inArray(meanings.wordId, wordIdSubquery),
            ),
          );

        const meaningIdSubquery = tx
          .select({ id: meanings.id })
          .from(meanings)
          .where(and(isNull(meanings.deletedAt), inArray(meanings.wordId, wordIdSubquery)));

        await tx
          .update(examples)
          .set({ createdBy: input.toUserId })
          .where(
            and(
              eq(examples.createdBy, input.fromUserId),
              isNull(examples.deletedAt),
              inArray(examples.meaningId, meaningIdSubquery),
            ),
          );
      }
    });

    const found = await this.findById(input.sessionId);
    if (!found) throw new Error('Import session hilang setelah klaim');
    return found;
  }

  async markRolledBack(sessionId: string, actorId: string): Promise<WordImportSession> {
    const now = new Date();
    await this.db
      .update(wordImportSessions)
      .set({
        rolledBackAt: now,
        rolledBackBy: actorId,
      })
      .where(and(eq(wordImportSessions.id, sessionId), isNull(wordImportSessions.rolledBackAt)));
    const found = await this.findById(sessionId);
    if (!found) throw new Error('Import session hilang setelah rollback');
    return found;
  }
}
