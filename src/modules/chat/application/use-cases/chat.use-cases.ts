import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { applyPiiPatternFilter } from '@/shared/moderation/apply-pii-pattern-filter';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import { VOICE_ROOM_ENABLED_KEY } from '@/modules/legal/domain/entities/app-setting.entity';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import { validateAudioFile } from '@/modules/word/application/utils/validate-audio-file';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import { generateId } from '@/shared/utils/ulid';
import {
  buildReplySnippet,
  CHAT_CHANNEL_PUBLIC,
  type ChatMessage,
  type ChatMessageKind,
  type ChatMessageRevision,
} from '../../domain/entities/chat-message.entity';
import type {
  ChatRepository,
  ListChatMessagesResult,
} from '../../domain/repositories/chat.repository';
import type { StickerRepository } from '@/modules/sticker/domain/repositories/sticker.repository';
import type { ChatSupabaseMirror } from '../../infrastructure/chat-supabase-mirror';
import { buildChatVoiceNotePath } from '../utils/chat-voice-note-path';

export { VOICE_ROOM_ENABLED_KEY };

/** Durasi voice note chat: 1-60 detik (P22). */
export const CHAT_VOICE_MIN_MS = 1_000;
export const CHAT_VOICE_MAX_MS = 60_000;

const BODY_MAX = 240;

function assertChatVoiceDurationMs(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Durasi rekaman wajib diisi (1-60 detik)',
      },
    ]);
  }
  const ms = Math.round(n);
  if (ms < CHAT_VOICE_MIN_MS) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Rekaman terlalu pendek. Minimal 1 detik ya.',
      },
    ]);
  }
  if (ms > CHAT_VOICE_MAX_MS) {
    throw new ValidationError([
      {
        field: 'duration_ms',
        message: 'Rekaman terlalu panjang. Maksimal 60 detik.',
      },
    ]);
  }
  return ms;
}

export class GetChatCapabilitiesUseCase {
  constructor(private readonly settingsRepo: AppSettingsRepository) {}

  async execute(): Promise<{ voice_room_enabled: boolean }> {
    const rows = await this.settingsRepo.getByKeys([VOICE_ROOM_ENABLED_KEY]);
    const raw = rows.find((r) => r.key === VOICE_ROOM_ENABLED_KEY)?.value;
    return { voice_room_enabled: raw === 'true' };
  }
}

export interface ListChatMessagesCommand {
  limit?: number;
  beforeCreatedAt?: Date;
  beforeId?: string;
  afterCreatedAt?: Date;
  afterId?: string;
}

export class ListChatMessagesUseCase {
  constructor(private readonly repo: ChatRepository) {}

  async execute(cmd: ListChatMessagesCommand): Promise<ListChatMessagesResult> {
    const hasBefore = Boolean(cmd.beforeCreatedAt && cmd.beforeId);
    const hasAfter = Boolean(cmd.afterCreatedAt && cmd.afterId);
    if (
      (cmd.beforeCreatedAt && !cmd.beforeId) ||
      (cmd.beforeId && !cmd.beforeCreatedAt)
    ) {
      throw new ValidationError([
        {
          field: 'before_id',
          message: 'before_created_at dan before_id harus dipakai berpasangan',
        },
      ]);
    }
    if (
      (cmd.afterCreatedAt && !cmd.afterId) ||
      (cmd.afterId && !cmd.afterCreatedAt)
    ) {
      throw new ValidationError([
        {
          field: 'after_id',
          message: 'after_created_at dan after_id harus dipakai berpasangan',
        },
      ]);
    }
    if (hasBefore && hasAfter) {
      throw new ValidationError([
        {
          field: 'before_id',
          message: 'Pakai before_* atau after_*, jangan keduanya',
        },
      ]);
    }

    return this.repo.list({
      channel: CHAT_CHANNEL_PUBLIC,
      limit: cmd.limit ?? 50,
      beforeCreatedAt: cmd.beforeCreatedAt,
      beforeId: cmd.beforeId,
      afterCreatedAt: cmd.afterCreatedAt,
      afterId: cmd.afterId,
    });
  }
}

export interface CreateChatMessageCommand {
  userId: string;
  kind?: 'text' | 'sticker';
  body?: string | null;
  stickerId?: string | null;
  replyToId?: string | null;
  requestId?: string | null;
}

export class CreateChatMessageUseCase {
  constructor(
    private readonly repo: ChatRepository,
    private readonly userRepo: UserRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly mirror: ChatSupabaseMirror,
    private readonly stickerRepo: StickerRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: CreateChatMessageCommand): Promise<ChatMessage> {
    await assertCanContribute(cmd.userId);

    const kind: ChatMessageKind = cmd.kind ?? 'text';
    if (kind !== 'text' && kind !== 'sticker') {
      throw new ValidationError([
        {
          field: 'kind',
          message: 'Jenis pesan hanya text atau sticker untuk sekarang',
        },
      ]);
    }

    let body: string | null = null;
    let stickerId: string | null = null;

    if (kind === 'text') {
      const raw = (cmd.body ?? '').trim();
      if (raw.length < 1) {
        throw new ValidationError([
          { field: 'body', message: 'Pesan teks tidak boleh kosong' },
        ]);
      }
      if (raw.length > BODY_MAX) {
        throw new ValidationError([
          {
            field: 'body',
            message: `Pesan maksimal ${BODY_MAX} karakter`,
          },
        ]);
      }
      const quality = await assertUgcTextQualityWithStrike(raw, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'chat_message',
        requestId: cmd.requestId,
      });
      const blocked = await this.blocklistRepo.listAllActiveWords();
      const filtered = applyBlocklistFilter(
        applyPiiPatternFilter(quality),
        blocked,
      );
      if (isHeavyCensor(quality, filtered)) {
        await safeRecordAbuseSignal(this.abuse, {
          userId: cmd.userId,
          signal: 'heavy_censor',
          entityType: 'chat_message',
          requestId: cmd.requestId,
        });
      }
      body = filtered;
    } else {
      const sid = (cmd.stickerId ?? '').trim();
      if (!sid) {
        throw new ValidationError([
          { field: 'sticker_id', message: 'Stiker wajib dipilih' },
        ]);
      }
      const catalog = await this.stickerRepo.findActiveById(sid);
      if (!catalog) {
        throw new ValidationError([
          {
            field: 'sticker_id',
            message: 'Stiker tidak tersedia. Pilih ulang dari daftar.',
          },
        ]);
      }
      stickerId = catalog.id;
      const rawBody = (cmd.body ?? '').trim();
      if (rawBody) {
        if (rawBody.length > BODY_MAX) {
          throw new ValidationError([
            {
              field: 'body',
              message: `Pesan maksimal ${BODY_MAX} karakter`,
            },
          ]);
        }
        const quality = await assertUgcTextQualityWithStrike(rawBody, {
          userId: cmd.userId,
          abuse: this.abuse,
          entityType: 'chat_message',
          requestId: cmd.requestId,
        });
        const blocked = await this.blocklistRepo.listAllActiveWords();
        body = applyBlocklistFilter(applyPiiPatternFilter(quality), blocked);
      }
    }

    let replyToId: string | null = null;
    let replySnippet: string | null = null;
    let replyUsername: string | null = null;
    if (cmd.replyToId) {
      const parent = await this.repo.findById(cmd.replyToId);
      if (!parent || parent.channel !== CHAT_CHANNEL_PUBLIC) {
        throw new NotFoundError(
          'CHAT_REPLY_NOT_FOUND',
          'Pesan yang dibalas tidak ditemukan',
        );
      }
      replyToId = parent.id;
      replySnippet = buildReplySnippet(parent);
      replyUsername = parent.username ?? parent.displayName ?? null;
    }

    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'Akun tidak ditemukan');
    }

    const created = await this.repo.create({
      channel: CHAT_CHANNEL_PUBLIC,
      userId: cmd.userId,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl ?? null,
      kind,
      body,
      stickerId,
      replyToId,
      replySnippet,
      replyUsername,
    });

    await this.mirror.upsert(created);
    return created;
  }
}

export interface EditChatMessageCommand {
  messageId: string;
  actorId: string;
  body: string;
  requestId?: string | null;
}

export class EditChatMessageUseCase {
  constructor(
    private readonly repo: ChatRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly mirror: ChatSupabaseMirror,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: EditChatMessageCommand): Promise<ChatMessage> {
    await assertCanContribute(cmd.actorId);

    const existing = await this.repo.findById(cmd.messageId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError(
        'CHAT_MESSAGE_NOT_FOUND',
        'Pesan tidak ditemukan',
      );
    }
    if (existing.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat mengedit pesan ini',
      );
    }
    if (existing.kind === 'voice_note') {
      throw new BadRequestError(
        'CHAT_EDIT_VOICE_UNSUPPORTED',
        'Voice note tidak bisa disunting. Hapus saja kalau mau ganti.',
      );
    }
    if (existing.kind !== 'text') {
      throw new BadRequestError(
        'CHAT_EDIT_KIND_UNSUPPORTED',
        'Hanya pesan teks yang bisa disunting',
      );
    }

    const raw = cmd.body.trim();
    if (raw.length < 1) {
      throw new ValidationError([
        { field: 'body', message: 'Pesan teks tidak boleh kosong' },
      ]);
    }
    if (raw.length > BODY_MAX) {
      throw new ValidationError([
        {
          field: 'body',
          message: `Pesan maksimal ${BODY_MAX} karakter`,
        },
      ]);
    }

    const quality = await assertUgcTextQualityWithStrike(raw, {
      userId: cmd.actorId,
      abuse: this.abuse,
      entityType: 'chat_message',
      requestId: cmd.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(
      applyPiiPatternFilter(quality),
      blocked,
    );
    if (isHeavyCensor(quality, filtered)) {
      await safeRecordAbuseSignal(this.abuse, {
        userId: cmd.actorId,
        signal: 'heavy_censor',
        entityType: 'chat_message',
        entityId: existing.id,
        requestId: cmd.requestId,
      });
    }

    const previousBody = existing.body ?? '';
    const updated = await this.repo.editText({
      id: existing.id,
      editorId: cmd.actorId,
      previousBody,
      body: filtered,
    });
    if (!updated) {
      throw new NotFoundError(
        'CHAT_MESSAGE_NOT_FOUND',
        'Pesan tidak ditemukan',
      );
    }

    await this.mirror.patch(updated);
    return updated;
  }
}

export interface CreateChatVoiceNoteCommand {
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  durationMs: unknown;
  replyToId?: string | null;
  requestId?: string | null;
}

/**
 * Voice note chat (F1b).
 * Urutan: generate id → upload GitHub → INSERT Turso → mirror Supabase
 * (tanpa path/sha). Upload gagal = tidak insert Turso.
 */
export class CreateChatVoiceNoteUseCase {
  constructor(
    private readonly repo: ChatRepository,
    private readonly userRepo: UserRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly mirror: ChatSupabaseMirror,
  ) {}

  async execute(cmd: CreateChatVoiceNoteCommand): Promise<ChatMessage> {
    await assertCanContribute(cmd.userId);

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = assertChatVoiceDurationMs(cmd.durationMs);

    let replyToId: string | null = null;
    let replySnippet: string | null = null;
    let replyUsername: string | null = null;
    if (cmd.replyToId) {
      const parent = await this.repo.findById(cmd.replyToId);
      if (!parent || parent.channel !== CHAT_CHANNEL_PUBLIC) {
        throw new NotFoundError(
          'CHAT_REPLY_NOT_FOUND',
          'Pesan yang dibalas tidak ditemukan',
        );
      }
      replyToId = parent.id;
      replySnippet = buildReplySnippet(parent);
      replyUsername = parent.username ?? parent.displayName ?? null;
    }

    const user = await this.userRepo.findById(cmd.userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'Akun tidak ditemukan');
    }

    const messageId = generateId();
    const path = buildChatVoiceNotePath({
      messageId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const created = await this.repo.create({
      id: messageId,
      channel: CHAT_CHANNEL_PUBLIC,
      userId: cmd.userId,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl ?? null,
      kind: 'voice_note',
      body: null,
      stickerId: null,
      audioUrl: uploaded.url,
      audioPath: uploaded.path,
      audioSha: uploaded.sha,
      durationMs,
      replyToId,
      replySnippet,
      replyUsername,
    });

    await this.mirror.upsert(created);
    return created;
  }
}

export interface DeleteChatMessageCommand {
  messageId: string;
  actorId: string;
}

export class DeleteChatMessageUseCase {
  constructor(
    private readonly repo: ChatRepository,
    private readonly mirror: ChatSupabaseMirror,
    private readonly storage?: PronunciationStoragePort,
  ) {}

  async execute(cmd: DeleteChatMessageCommand): Promise<ChatMessage> {
    await assertCanContribute(cmd.actorId);

    const existing = await this.repo.findById(cmd.messageId);
    if (!existing) {
      throw new NotFoundError(
        'CHAT_MESSAGE_NOT_FOUND',
        'Pesan tidak ditemukan',
      );
    }
    if (existing.deletedAt) {
      return existing;
    }
    if (existing.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat menghapus pesan ini',
      );
    }

    const audioPath = existing.audioPath;
    const audioSha = existing.audioSha;
    const shouldDeleteAudio =
      existing.kind === 'voice_note' &&
      Boolean(audioPath) &&
      Boolean(audioSha) &&
      Boolean(this.storage);

    // Port storage.delete sudah best-effort (gagal → log, jangan lempar).
    if (shouldDeleteAudio && this.storage && audioPath && audioSha) {
      await this.storage.delete(audioPath, audioSha);
    }

    const tombstoned = await this.repo.tombstone({
      id: existing.id,
      deletedBy: cmd.actorId,
      reason: 'author',
    });
    if (!tombstoned) {
      throw new NotFoundError(
        'CHAT_MESSAGE_NOT_FOUND',
        'Pesan tidak ditemukan',
      );
    }

    await this.mirror.patch(tombstoned);
    return tombstoned;
  }
}

export class ListChatRevisionsUseCase {
  constructor(private readonly repo: ChatRepository) {}

  async execute(messageId: string): Promise<ChatMessageRevision[]> {
    const existing = await this.repo.findById(messageId);
    if (!existing) {
      throw new NotFoundError(
        'CHAT_MESSAGE_NOT_FOUND',
        'Pesan tidak ditemukan',
      );
    }
    return this.repo.listRevisions(messageId);
  }
}
