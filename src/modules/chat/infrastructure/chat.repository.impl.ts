import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  chatMessageDeletions,
  chatMessageModerationSnapshots,
  chatMessageRevisions,
  chatMessages,
} from '@/shared/database/drizzle/schema/chat.schema';
import {
  CHAT_PING_BODY,
  CHAT_TOMBSTONE_SNIPPET,
  type ChatMessage,
  type ChatMessageKind,
  type ChatMessageModerationSnapshot,
  type ChatMessageRevision,
} from '../domain/entities/chat-message.entity';
import type {
  ChatRepository,
  CreateChatMessageInput,
  EditChatMessageInput,
  ListChatMessagesFilter,
  ListChatMessagesResult,
  TombstoneChatMessageInput,
} from '../domain/repositories/chat.repository';

type ChatRow = typeof chatMessages.$inferSelect;

function toDomain(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    channel: row.channel,
    userId: row.userId,
    username: row.username ?? null,
    displayName: row.displayName ?? null,
    avatarUrl: row.avatarUrl ?? null,
    kind: (row.kind as ChatMessageKind) || 'text',
    body: row.body ?? null,
    stickerId: row.stickerId ?? null,
    audioUrl: row.audioUrl ?? null,
    audioPath: row.audioPath ?? null,
    audioSha: row.audioSha ?? null,
    durationMs: row.durationMs ?? null,
    replyToId: row.replyToId ?? null,
    replySnippet: row.replySnippet ?? null,
    replyUsername: row.replyUsername ?? null,
    editedAt: row.editedAt ?? null,
    deletedAt: row.deletedAt ?? null,
    deletedBy: row.deletedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

function toRevision(
  row: typeof chatMessageRevisions.$inferSelect,
): ChatMessageRevision {
  return {
    id: row.id,
    messageId: row.messageId,
    editorId: row.editorId,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export class ChatRepositoryImpl implements ChatRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    const [row] = await this.db
      .insert(chatMessages)
      .values({
        ...(input.id ? { id: input.id } : {}),
        channel: input.channel,
        userId: input.userId,
        username: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        kind: input.kind,
        body: input.body,
        stickerId: input.stickerId,
        audioUrl: input.audioUrl ?? null,
        audioPath: input.audioPath ?? null,
        audioSha: input.audioSha ?? null,
        durationMs: input.durationMs ?? null,
        replyToId: input.replyToId,
        replySnippet: input.replySnippet,
        replyUsername: input.replyUsername,
      })
      .returning();
    return toDomain(row);
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const [row] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(filter: ListChatMessagesFilter): Promise<ListChatMessagesResult> {
    const limit = Math.min(Math.max(filter.limit || 50, 1), 100);
    const conds = [eq(chatMessages.channel, filter.channel)];

    const hasBefore = filter.beforeCreatedAt && filter.beforeId;
    const hasAfter = filter.afterCreatedAt && filter.afterId;

    if (hasBefore) {
      conds.push(
        sql`(${chatMessages.createdAt} < ${filter.beforeCreatedAt} or (${chatMessages.createdAt} = ${filter.beforeCreatedAt} and ${chatMessages.id} < ${filter.beforeId}))`,
      );
    } else if (hasAfter) {
      conds.push(
        sql`(${chatMessages.createdAt} > ${filter.afterCreatedAt} or (${chatMessages.createdAt} = ${filter.afterCreatedAt} and ${chatMessages.id} > ${filter.afterId}))`,
      );
    }

    // Default / before: ambil terbaru dulu lalu reverse ke ASC (baca chat).
    // after: ASC langsung (pesan lebih baru).
    const orderNewestFirst = !hasAfter;
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(and(...conds))
      .orderBy(
        orderNewestFirst
          ? desc(chatMessages.createdAt)
          : asc(chatMessages.createdAt),
        orderNewestFirst ? desc(chatMessages.id) : asc(chatMessages.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const items = (orderNewestFirst ? [...slice].reverse() : slice).map(
      toDomain,
    );
    return { items, hasMore };
  }

  async editText(input: EditChatMessageInput): Promise<ChatMessage | null> {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await tx.insert(chatMessageRevisions).values({
        messageId: input.id,
        editorId: input.editorId,
        body: input.previousBody,
      });
      const [row] = await tx
        .update(chatMessages)
        .set({
          body: input.body,
          editedAt: now,
          updatedAt: now,
        })
        .where(eq(chatMessages.id, input.id))
        .returning();
      return row ? toDomain(row) : null;
    });
  }

  async tombstone(
    input: TombstoneChatMessageInput,
  ): Promise<ChatMessage | null> {
    const now = new Date();
    const reason = input.reason ?? 'author';
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, input.id));
      if (!current) return null;

      // Salinan moderasi (admin-only) sebelum body & revisi dihapus.
      const revisions = await tx
        .select()
        .from(chatMessageRevisions)
        .where(eq(chatMessageRevisions.messageId, input.id))
        .orderBy(asc(chatMessageRevisions.createdAt));
      await tx
        .insert(chatMessageModerationSnapshots)
        .values({
          messageId: current.id,
          userId: current.userId,
          username: current.username,
          displayName: current.displayName,
          kind: current.kind,
          body: current.body,
          stickerId: current.stickerId,
          replyToId: current.replyToId,
          replySnippet: current.replySnippet,
          revisionsJson: revisions.map((r) => ({
            body: r.body,
            editor_id: r.editorId,
            created_at: r.createdAt.toISOString(),
          })),
          messageCreatedAt: current.createdAt,
          deletedAt: now,
          deletedBy: input.deletedBy,
          deletionReason: reason,
          snapshotAt: now,
        })
        .onConflictDoNothing();

      // Riwayat suntingan tidak lagi bisa dibaca pengguna.
      await tx
        .delete(chatMessageRevisions)
        .where(eq(chatMessageRevisions.messageId, input.id));

      const [row] = await tx
        .update(chatMessages)
        .set({
          body: null,
          stickerId: null,
          audioUrl: null,
          audioPath: null,
          audioSha: null,
          durationMs: null,
          deletedAt: now,
          deletedBy: input.deletedBy,
          updatedAt: now,
        })
        .where(eq(chatMessages.id, input.id))
        .returning();
      if (!row) return null;

      // Kutipan di balasan orang lain tidak boleh menampilkan teks asli.
      await tx
        .update(chatMessages)
        .set({ replySnippet: CHAT_TOMBSTONE_SNIPPET })
        .where(eq(chatMessages.replyToId, input.id));

      await tx
        .insert(chatMessageDeletions)
        .values({
          messageId: input.id,
          deletedBy: input.deletedBy,
          reason,
        })
        .onConflictDoNothing();

      return toDomain(row);
    });
  }

  async findModerationSnapshot(
    messageId: string,
  ): Promise<ChatMessageModerationSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(chatMessageModerationSnapshots)
      .where(eq(chatMessageModerationSnapshots.messageId, messageId))
      .limit(1);
    if (!row) return null;
    return {
      messageId: row.messageId,
      userId: row.userId,
      username: row.username ?? null,
      displayName: row.displayName ?? null,
      kind: (row.kind as ChatMessageKind) || 'text',
      body: row.body ?? null,
      stickerId: row.stickerId ?? null,
      replyToId: row.replyToId ?? null,
      replySnippet: row.replySnippet ?? null,
      revisions: (row.revisionsJson as ChatMessageModerationSnapshot['revisions']) ?? [],
      messageCreatedAt: row.messageCreatedAt,
      deletedAt: row.deletedAt,
      deletedBy: row.deletedBy,
      deletionReason: row.deletionReason ?? null,
      snapshotAt: row.snapshotAt,
    };
  }

  async listRevisions(messageId: string): Promise<ChatMessageRevision[]> {
    const rows = await this.db
      .select()
      .from(chatMessageRevisions)
      .where(eq(chatMessageRevisions.messageId, messageId))
      .orderBy(desc(chatMessageRevisions.createdAt));
    return rows.map(toRevision);
  }

  async findLatestPing(channel: string): Promise<ChatMessage | null> {
    const [row] = await this.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channel, channel),
          eq(chatMessages.kind, 'system'),
          eq(chatMessages.body, CHAT_PING_BODY),
          sql`${chatMessages.deletedAt} is null`,
        ),
      )
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

}
