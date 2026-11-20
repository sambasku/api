import type { Context } from 'hono';
import { BadRequestError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import type {
  ChatMessage,
  ChatMessageRevision,
} from '../../domain/entities/chat-message.entity';
import type {
  CreateChatMessageUseCase,
  CreateChatVoiceNoteUseCase,
  DeleteChatMessageUseCase,
  EditChatMessageUseCase,
  GetChatCapabilitiesUseCase,
  ListChatMessagesUseCase,
  ListChatRevisionsUseCase,
} from '../../application/use-cases/chat.use-cases';
import type {
  GetChatPingStatusUseCase,
  SendChatPingUseCase,
} from '../../application/use-cases/send-chat-ping.use-case';

function serializeMessage(m: ChatMessage) {
  return {
    id: m.id,
    channel: m.channel,
    user_id: m.userId,
    username: m.username,
    display_name: m.displayName,
    avatar_url: m.avatarUrl,
    kind: m.kind,
    body: m.body,
    sticker_id: m.stickerId,
    audio_url: m.audioUrl,
    duration_ms: m.durationMs,
    reply_to_id: m.replyToId,
    reply_snippet: m.replySnippet,
    reply_username: m.replyUsername,
    edited_at: m.editedAt?.toISOString() ?? null,
    deleted_at: m.deletedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
  };
}

function serializeRevision(r: ChatMessageRevision) {
  return {
    id: r.id,
    message_id: r.messageId,
    editor_id: r.editorId,
    body: r.body,
    created_at: r.createdAt.toISOString(),
  };
}

export class ChatController {
  constructor(
    private readonly capabilities: GetChatCapabilitiesUseCase,
    private readonly listMessages: ListChatMessagesUseCase,
    private readonly createMessage: CreateChatMessageUseCase,
    private readonly createVoiceNote: CreateChatVoiceNoteUseCase,
    private readonly editMessage: EditChatMessageUseCase,
    private readonly deleteMessage: DeleteChatMessageUseCase,
    private readonly listRevisions: ListChatRevisionsUseCase,
    private readonly getPingStatus: GetChatPingStatusUseCase,
    private readonly sendPing: SendChatPingUseCase,
  ) {}

  getCapabilities(c: Context<{ Variables: AppVariables }>) {
    return this.capabilities.execute().then((data) =>
      c.json({ success: true as const, data }, 200),
    );
  }

  list(
    c: Context<{ Variables: AppVariables }>,
    query: {
      limit: number;
      before_created_at?: string;
      before_id?: string;
      after_created_at?: string;
      after_id?: string;
    },
  ) {
    return this.listMessages
      .execute({
        limit: query.limit,
        beforeCreatedAt: query.before_created_at
          ? new Date(query.before_created_at)
          : undefined,
        beforeId: query.before_id,
        afterCreatedAt: query.after_created_at
          ? new Date(query.after_created_at)
          : undefined,
        afterId: query.after_id,
      })
      .then((r) =>
        c.json(
          {
            success: true as const,
            data: {
              items: r.items.map(serializeMessage),
              has_more: r.hasMore,
            },
          },
          200,
        ),
      );
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: {
      kind?: 'text' | 'sticker';
      body?: string | null;
      sticker_id?: string | null;
      reply_to_id?: string | null;
    },
  ) {
    const user = c.get('user')!;
    return this.createMessage
      .execute({
        userId: user.user_id,
        kind: body.kind,
        body: body.body,
        stickerId: body.sticker_id,
        replyToId: body.reply_to_id,
        requestId: c.get('requestId'),
      })
      .then((m) =>
        c.json({ success: true as const, data: serializeMessage(m) }, 201),
      );
  }

  async createVoice(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user')!;
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
      throw new BadRequestError(
        'AUDIO_TOO_LARGE',
        'File audio terlalu besar (maks 5 MB)',
        [{ field: 'audio', message: 'Ukuran maksimal 5 MB' }],
      );
    }

    const body = await c.req.parseBody({ all: true });
    const audioPart = body['audio'];
    if (!audioPart || typeof audioPart === 'string') {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'File audio wajib diunggah',
        [
          {
            field: 'audio',
            message: 'Field multipart `audio` wajib berisi file',
          },
        ],
      );
    }

    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const replyToRaw = body['reply_to_id'];
    const replyToId =
      typeof replyToRaw === 'string' && replyToRaw.trim()
        ? replyToRaw.trim()
        : null;

    const m = await this.createVoiceNote.execute({
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      replyToId,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: serializeMessage(m) }, 201);
  }

  edit(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { body: string },
  ) {
    const user = c.get('user')!;
    return this.editMessage
      .execute({
        messageId: id,
        actorId: user.user_id,
        body: body.body,
        requestId: c.get('requestId'),
      })
      .then((m) =>
        c.json({ success: true as const, data: serializeMessage(m) }, 200),
      );
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user')!;
    return this.deleteMessage
      .execute({ messageId: id, actorId: user.user_id })
      .then((m) =>
        c.json({ success: true as const, data: serializeMessage(m) }, 200),
      );
  }

  revisions(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.listRevisions.execute(id).then((items) =>
      c.json(
        {
          success: true as const,
          data: items.map(serializeRevision),
        },
        200,
      ),
    );
  }

  pingStatus(c: Context<{ Variables: AppVariables }>) {
    return this.getPingStatus.execute().then((s) =>
      c.json(
        {
          success: true as const,
          data: {
            available_at: s.availableAt,
            cooldown_seconds: s.cooldownSeconds,
            last_ping_at: s.lastPingAt,
          },
        },
        200,
      ),
    );
  }
  ping(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user')!;
    return this.sendPing.execute(user.user_id).then((r) =>
      c.json(
        {
          success: true as const,
          data: {
            message: serializeMessage(r.message),
            status: {
              available_at: r.status.availableAt,
              cooldown_seconds: r.status.cooldownSeconds,
              last_ping_at: r.status.lastPingAt,
            },
          },
        },
        201,
      ),
    );
  }
}
