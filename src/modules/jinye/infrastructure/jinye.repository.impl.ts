import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import {
  jinye,
  jinyeComments,
  jinyeRevisions,
  users,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  JinyeCommentStatus,
  JinyeStatus,
} from '@/shared/database/drizzle/schema/jinye.schema';
import type {
  Jinye,
  JinyeAudio,
  JinyeComment,
  JinyeListFilter,
  NewJinye,
  NewJinyeComment,
} from '../domain/entities/jinye.entity';
import { toImageRows, toJinyeImages } from '../domain/entities/jinye.entity';
import type { JinyeRepository } from '../domain/repositories/jinye.repository';

type JinyeRow = typeof jinye.$inferSelect;
type JinyeCommentRow = typeof jinyeComments.$inferSelect;

function toAudio(
  row: Pick<
    JinyeRow,
    | 'audioUrl'
    | 'audioMimeType'
    | 'audioFileSize'
    | 'audioDurationMs'
    | 'audioProvider'
    | 'audioProviderFileId'
    | 'audioSha'
  >,
): JinyeAudio | null {
  if (
    typeof row.audioUrl !== 'string' ||
    row.audioUrl.length === 0 ||
    typeof row.audioMimeType !== 'string' ||
    typeof row.audioProvider !== 'string' ||
    typeof row.audioProviderFileId !== 'string'
  ) {
    return null;
  }
  return {
    url: row.audioUrl,
    mimeType: row.audioMimeType,
    fileSize: row.audioFileSize ?? 0,
    durationMs: row.audioDurationMs ?? null,
    provider: row.audioProvider,
    providerFileId: row.audioProviderFileId,
    sha: row.audioSha ?? null,
  };
}

function audioInsertValues(audio: JinyeAudio | null | undefined) {
  if (!audio) {
    return {
      audioUrl: null as string | null,
      audioMimeType: null as string | null,
      audioFileSize: null as number | null,
      audioDurationMs: null as number | null,
      audioProvider: null as string | null,
      audioProviderFileId: null as string | null,
      audioSha: null as string | null,
    };
  }
  return {
    audioUrl: audio.url,
    audioMimeType: audio.mimeType,
    audioFileSize: audio.fileSize,
    audioDurationMs: audio.durationMs,
    audioProvider: audio.provider,
    audioProviderFileId: audio.providerFileId,
    audioSha: audio.sha,
  };
}

const isEditedSql = sql<boolean>`EXISTS (
  SELECT 1 FROM ${jinyeRevisions}
  WHERE ${jinyeRevisions.jinyeId} = ${jinye.id}
)`;

function mapJoined(row: {
  jinye: JinyeRow;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  authorDeletedAt: Date | null;
  userRole: string | null;
  isEdited: boolean;
}): Jinye {
  const deleted = row.authorDeletedAt != null;
  return {
    id: row.jinye.id,
    userId: row.jinye.userId,
    username: publicAccountName(row.username, deleted ? new Date() : null),
    displayName: publicAccountDisplayName(
      row.displayName,
      row.username,
      deleted ? new Date() : null,
    ),
    avatarUrl: deleted ? null : (row.avatarUrl ?? null),
    userRole: deleted ? null : (row.userRole ?? null),
    body: row.jinye.body ?? '',
    bodyOriginal: row.jinye.bodyOriginal ?? null,
    images: toJinyeImages(row.jinye.images),
    audio: toAudio(row.jinye),
    repostOfId: row.jinye.repostOfId ?? null,
    quoteBody: row.jinye.quoteBody ?? null,
    status: row.jinye.status as JinyeStatus,
    publishedCommentCount: row.jinye.publishedCommentCount ?? 0,
    repostCount: row.jinye.repostCount ?? 0,
    createdAt: row.jinye.createdAt,
    updatedAt: row.jinye.updatedAt ?? null,
    isEdited: !!row.isEdited,
  };
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [iso, id] = raw.split('\n');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function encodeJinyeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}\n${id}`, 'utf8').toString('base64url');
}

export class JinyeRepositoryImpl implements JinyeRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewJinye): Promise<Jinye> {
    const [row] = await this.db
      .insert(jinye)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal ?? null,
        images: toImageRows(input.images),
        ...audioInsertValues(input.audio),
        status: 'published',
      })
      .returning();
    const created = await this.findById(row.id);
    if (!created) throw new Error('jinye create: row missing after insert');
    return created;
  }

  async findById(id: string): Promise<Jinye | null> {
    const rows = await this.db
      .select({
        jinye,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: isEditedSql,
      })
      .from(jinye)
      .leftJoin(users, eq(users.id, jinye.userId))
      .where(eq(jinye.id, id))
      .limit(1);
    const row = rows[0];
    return row ? mapJoined(row) : null;
  }

  async list(filter: JinyeListFilter): Promise<CursorPage<Jinye>> {
    const limit = Math.min(Math.max(filter.limit || 20, 1), 50);
    const cur = decodeCursor(filter.cursor);
    const status = filter.status ?? 'published';
    const conds = [];
    if (status !== 'all') {
      conds.push(eq(jinye.status, status));
    }
    if (filter.userId) {
      conds.push(eq(jinye.userId, filter.userId));
    }
    if (cur) {
      conds.push(
        sql`(${jinye.createdAt} < ${cur.createdAt} or (${jinye.createdAt} = ${cur.createdAt} and ${jinye.id} < ${cur.id}))`,
      );
    }

    const rows = await this.db
      .select({
        jinye,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: isEditedSql,
      })
      .from(jinye)
      .leftJoin(users, eq(users.id, jinye.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(jinye.createdAt), desc(jinye.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map(mapJoined);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor:
        hasMore && last ? encodeJinyeCursor(last.createdAt, last.id) : null,
      hasMore,
    };
  }

  async findLatestCreatedAtByUser(userId: string): Promise<Date | null> {
    const rows = await this.db
      .select({ createdAt: jinye.createdAt })
      .from(jinye)
      .where(eq(jinye.userId, userId))
      .orderBy(desc(jinye.createdAt))
      .limit(1);
    return rows[0]?.createdAt ?? null;
  }

  async markDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(jinye)
      .set({
        status: 'deleted_by_author',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jinye.id, id),
          eq(jinye.userId, actorId),
          sql`${jinye.status} in ('published', 'archived')`,
        ),
      )
      .returning({ id: jinye.id });
    return updated.length > 0;
  }

  async setAudio(input: { id: string; audio: JinyeAudio }): Promise<Jinye | null> {
    const updated = await this.db
      .update(jinye)
      .set({
        ...audioInsertValues(input.audio),
        updatedAt: new Date(),
      })
      .where(eq(jinye.id, input.id))
      .returning({ id: jinye.id });
    if (updated.length === 0) return null;
    return this.findById(input.id);
  }

  async createComment(input: NewJinyeComment): Promise<JinyeComment> {
    const [row] = await this.db
      .insert(jinyeComments)
      .values({
        jinyeId: input.jinyeId,
        parentId: input.parentId ?? null,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal ?? null,
        images: toImageRows(input.images ?? []),
        status: 'published',
      })
      .returning();
    const created = await this.findCommentById(row.id);
    if (!created) throw new Error('jinye comment create: row missing after insert');
    return created;
  }

  async findCommentById(id: string): Promise<JinyeComment | null> {
    const rows = await this.db
      .select({
        comment: jinyeComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
      })
      .from(jinyeComments)
      .leftJoin(users, eq(users.id, jinyeComments.userId))
      .where(eq(jinyeComments.id, id))
      .limit(1);
    const row = rows[0];
    return row ? mapCommentJoined(row) : null;
  }

  async listCommentsByJinyeId(jinyeId: string): Promise<JinyeComment[]> {
    const rows = await this.db
      .select({
        comment: jinyeComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
      })
      .from(jinyeComments)
      .leftJoin(users, eq(users.id, jinyeComments.userId))
      .where(
        and(
          eq(jinyeComments.jinyeId, jinyeId),
          eq(jinyeComments.status, 'published'),
        ),
      )
      .orderBy(asc(jinyeComments.createdAt), asc(jinyeComments.id));

    return rows.map(mapCommentJoined);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const updated = await this.db
      .update(jinyeComments)
      .set({
        status: 'deleted_by_author',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jinyeComments.id, id),
          eq(jinyeComments.userId, actorId),
          eq(jinyeComments.status, 'published'),
        ),
      )
      .returning({ id: jinyeComments.id });
    return updated.length > 0;
  }

  async incrementPublishedCommentCount(jinyeId: string, delta: number): Promise<void> {
    await this.db
      .update(jinye)
      .set({
        publishedCommentCount: sql`max(0, ${jinye.publishedCommentCount} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(eq(jinye.id, jinyeId));
  }
}

function mapCommentJoined(row: {
  comment: JinyeCommentRow;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  authorDeletedAt: Date | null;
  userRole: string | null;
}): JinyeComment {
  const deleted = row.authorDeletedAt != null;
  return {
    id: row.comment.id,
    jinyeId: row.comment.jinyeId,
    parentId: row.comment.parentId ?? null,
    userId: row.comment.userId,
    username: publicAccountName(row.username, deleted ? new Date() : null),
    displayName: publicAccountDisplayName(
      row.displayName,
      row.username,
      deleted ? new Date() : null,
    ),
    avatarUrl: deleted ? null : (row.avatarUrl ?? null),
    userRole: deleted ? null : (row.userRole ?? null),
    body: row.comment.body ?? '',
    bodyOriginal: row.comment.bodyOriginal ?? null,
    images: toJinyeImages(row.comment.images),
    status: row.comment.status as JinyeCommentStatus,
    createdAt: row.comment.createdAt,
    updatedAt: row.comment.updatedAt ?? null,
  };
}
