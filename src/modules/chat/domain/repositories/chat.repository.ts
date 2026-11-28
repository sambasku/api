import type {
  ChatMessage,
  ChatMessageKind,
  ChatMessageModerationSnapshot,
  ChatMessageRevision,
} from '../entities/chat-message.entity';

export interface CreateChatMessageInput {
  id?: string;
  channel: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  kind: ChatMessageKind;
  body: string | null;
  stickerId: string | null;
  audioUrl?: string | null;
  /** Turso-only - untuk best-effort delete GitHub. */
  audioPath?: string | null;
  /** Turso-only - untuk best-effort delete GitHub. */
  audioSha?: string | null;
  durationMs?: number | null;
  replyToId: string | null;
  replySnippet: string | null;
  replyUsername: string | null;
}

export interface ListChatMessagesFilter {
  channel: string;
  limit: number;
  beforeCreatedAt?: Date;
  beforeId?: string;
  afterCreatedAt?: Date;
  afterId?: string;
}

export interface ListChatMessagesResult {
  items: ChatMessage[];
  hasMore: boolean;
}

export interface EditChatMessageInput {
  id: string;
  editorId: string;
  /** Body lama yang disimpan ke revisions. */
  previousBody: string;
  body: string;
}

export interface TombstoneChatMessageInput {
  id: string;
  deletedBy: string;
  reason?: string | null;
}

export interface ChatRepository {
  create(input: CreateChatMessageInput): Promise<ChatMessage>;
  findById(id: string): Promise<ChatMessage | null>;
  list(filter: ListChatMessagesFilter): Promise<ListChatMessagesResult>;
  editText(input: EditChatMessageInput): Promise<ChatMessage | null>;
  tombstone(input: TombstoneChatMessageInput): Promise<ChatMessage | null>;
  listRevisions(messageId: string): Promise<ChatMessageRevision[]>;
  /** Ping terakhir (kind=system, body=PING!!!) di channel. */
  findLatestPing(channel: string): Promise<ChatMessage | null>;
  /** Salinan moderasi pesan terhapus (admin only). */
  findModerationSnapshot(
    messageId: string,
  ): Promise<ChatMessageModerationSnapshot | null>;
}
