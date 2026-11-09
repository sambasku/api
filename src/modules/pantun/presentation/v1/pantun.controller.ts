import type { Context } from 'hono';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  Pantun,
  PantunAudio,
  PantunReply,
} from '../../domain/entities/pantun.entity';
import type {
  PantunReplyWithVotes,
  PantunWithVotes,
} from '../../application/use-cases/get-pantun-detail.use-case';
import type { CreatePantunUseCase } from '../../application/use-cases/create-pantun.use-case';
import type { CreatePantunWithAudioUseCase } from '../../application/use-cases/create-pantun-with-audio.use-case';
import type { CreatePantunReplyUseCase } from '../../application/use-cases/create-pantun-reply.use-case';
import type { CreatePantunReplyWithAudioUseCase } from '../../application/use-cases/create-pantun-reply-with-audio.use-case';
import type { ListPublishedPantunsUseCase } from '../../application/use-cases/list-published-pantuns.use-case';
import type { GetPantunDetailUseCase } from '../../application/use-cases/get-pantun-detail.use-case';
import type { TakedownPantunUseCase } from '../../application/use-cases/takedown-pantun.use-case';
import type { TakedownPantunReplyUseCase } from '../../application/use-cases/takedown-pantun-reply.use-case';
import type { DeletePantunReplyUseCase } from '../../application/use-cases/delete-pantun-reply.use-case';
import type { DeletePantunUseCase } from '../../application/use-cases/delete-pantun.use-case';
import type { UpdatePantunReplyUseCase } from '../../application/use-cases/update-pantun-reply.use-case';
import type { GetPantunReplyEditHistoryUseCase } from '../../application/use-cases/get-pantun-reply-edit-history.use-case';
import type { ListAdminPantunsUseCase } from '../../application/use-cases/list-admin-pantuns.use-case';
import type { SearchPantunsUseCase } from '../../application/use-cases/search-pantuns.use-case';
import type { PantunSearchHit } from '../../domain/repositories/pantun.repository';
import type {
  CreatePantunBody,
  CreatePantunReplyBody,
  UpdatePantunReplyBody,
  ListPantunsQuery,
  ListAdminPantunsQuery,
  PantunSearchQuery,
} from './validators/pantun.validator';
import { pantunLinesSchema, rhymeSchemeSchema } from './validators/pantun.validator';
import { opaqueId } from '@/shared/validation/id';

function audioWire(audio: PantunAudio | null | undefined, expose: boolean) {
  if (!expose || !audio) {
    return {
      audio_url: null as string | null,
      audio_mime_type: null as string | null,
      audio_duration_ms: null as number | null,
    };
  }
  return {
    audio_url: audio.url,
    audio_mime_type: audio.mimeType,
    audio_duration_ms: audio.durationMs,
  };
}

function toItem(p: Pantun | PantunWithVotes) {
  const published = p.status === 'published';
  const voiceOnly = p.lines.length === 0;
  return {
    id: p.id,
    user_id: p.userId,
    username: p.username,
    display_name: p.displayName,
    avatar_url: p.avatarUrl,
    is_verifier: isVerifierRole(p.userRole ?? ''),
    parent_id: null as string | null,
    language: p.language,
    theme_id: p.categoryId,
    rhyme_scheme: voiceOnly ? null : p.rhymeScheme,
    lines: p.lines,
    ...audioWire(p.audio, published),
    status: p.status,
    upvotes: 'upvotes' in p ? p.upvotes : 0,
    downvotes: 'downvotes' in p ? p.downvotes : 0,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt?.toISOString() ?? null,
    is_edited: false,
  };
}

function toReplyItem(r: PantunReply | PantunReplyWithVotes) {
  const published = r.status === 'published';
  const lines = published ? r.lines : [];
  const voiceOnly = lines.length === 0;
  return {
    id: r.id,
    user_id: r.userId,
    username: r.username,
    display_name: r.displayName,
    avatar_url: r.avatarUrl,
    is_verifier: isVerifierRole(r.userRole ?? ''),
    parent_id: r.parentId,
    language: r.language,
    theme_id: r.categoryId,
    rhyme_scheme: voiceOnly ? null : r.rhymeScheme,
    lines,
    ...audioWire(r.audio, published),
    status: r.status,
    upvotes: 'upvotes' in r ? r.upvotes : 0,
    downvotes: 'downvotes' in r ? r.downvotes : 0,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt?.toISOString() ?? null,
    is_edited: r.isEdited ?? false,
  };
}

/** Multipart audio: lines opsional (kosong / absen = voice-only). */
function parseOptionalLinesField(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]') return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.length === 0) return [];
      return pantunLinesSchema.parse(parsed);
    } catch {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Field lines harus JSON array 4 baris atau kosong',
        [{ field: 'lines', message: 'Pantun harus terdiri dari 4 baris' }],
      );
    }
  }
  if (Array.isArray(raw) && raw.length === 0) return [];
  return pantunLinesSchema.parse(raw);
}

export class PantunController {
  constructor(
    private readonly deps: {
      create: CreatePantunUseCase;
      createWithAudio: CreatePantunWithAudioUseCase;
      createReply: CreatePantunReplyUseCase;
      createReplyWithAudio: CreatePantunReplyWithAudioUseCase;
      listPublished: ListPublishedPantunsUseCase;
      getDetail: GetPantunDetailUseCase;
      takedown: TakedownPantunUseCase;
      takedownReply: TakedownPantunReplyUseCase;
      deleteReply: DeletePantunReplyUseCase;
      deletePantun: DeletePantunUseCase;
      updateReply: UpdatePantunReplyUseCase;
      getReplyEditHistory: GetPantunReplyEditHistoryUseCase;
      listAdmin: ListAdminPantunsUseCase;
      search: SearchPantunsUseCase;
    },
  ) {}

  async create(c: Context, body: CreatePantunBody) {
    const user = this.requireUser(c);
    const row = await this.deps.create.execute({
      userId: user.user_id,
      lines: body.lines,
      rhymeScheme: body.rhyme_scheme ?? null,
      categoryId: body.category_id ?? null,
      language: body.language ?? null,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toItem(row) }, 201);
  }

  async createWithAudio(c: Context) {
    const user = this.requireUser(c);
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
        [{ field: 'audio', message: 'Field multipart `audio` wajib berisi file' }],
      );
    }
    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lines = parseOptionalLinesField(body['lines']);
    const rhymeRaw =
      typeof body['rhyme_scheme'] === 'string' ? body['rhyme_scheme'] : undefined;
    const rhymeScheme = rhymeRaw
      ? rhymeSchemeSchema.parse(rhymeRaw)
      : undefined;
    const categoryId =
      typeof body['category_id'] === 'string' && body['category_id'].trim()
        ? opaqueId.parse(body['category_id'])
        : null;
    const language =
      typeof body['language'] === 'string' ? body['language'] : null;

    const row = await this.deps.createWithAudio.execute({
      userId: user.user_id,
      lines,
      rhymeScheme: rhymeScheme ?? null,
      categoryId,
      language,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toItem(row) }, 201);
  }

  async createReplyWithAudio(c: Context, parentId: string) {
    const user = this.requireUser(c);
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
        [{ field: 'audio', message: 'Field multipart `audio` wajib berisi file' }],
      );
    }
    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lines = parseOptionalLinesField(body['lines']);
    const rhymeRaw =
      typeof body['rhyme_scheme'] === 'string' ? body['rhyme_scheme'] : undefined;
    const rhymeScheme = rhymeRaw
      ? rhymeSchemeSchema.parse(rhymeRaw)
      : undefined;
    const categoryId =
      typeof body['category_id'] === 'string' && body['category_id'].trim()
        ? opaqueId.parse(body['category_id'])
        : null;
    const language =
      typeof body['language'] === 'string' ? body['language'] : null;

    const reply = await this.deps.createReplyWithAudio.execute({
      parentId,
      userId: user.user_id,
      lines,
      rhymeScheme: rhymeScheme ?? null,
      categoryId,
      language,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toReplyItem(reply) }, 201);
  }

  async listPublished(c: Context, query: ListPantunsQuery) {
    const page = await this.deps.listPublished.execute({
      limit: query.limit,
      cursor: query.cursor,
      categoryId: query.category_id,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toItem),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async search(c: Context, query: PantunSearchQuery) {
    const hits = await this.deps.search.execute(query.q, query.limit);
    const data = hits.map((hit: PantunSearchHit) =>
      hit.kind === 'pantun' ? toItem(hit.pantun) : toReplyItem(hit.reply),
    );
    return c.json({
      success: true as const,
      data,
      meta: { limit: query.limit, q: query.q },
    });
  }

  async getDetail(c: Context, id: string) {
    const { pantun, replies } = await this.deps.getDetail.execute(id);
    if (pantun.status !== 'published') {
      return c.json({ success: false as const, error_code: 'PANTUN_NOT_FOUND', message: 'Pantun tidak ditemukan' }, 404);
    }
    return c.json({
      success: true as const,
      data: { ...toItem(pantun), replies: replies.map(toReplyItem) },
    });
  }

  async createReply(c: Context, id: string, body: CreatePantunReplyBody) {
    const user = this.requireUser(c);
    const reply = await this.deps.createReply.execute({
      parentId: id,
      userId: user.user_id,
      lines: body.lines,
      rhymeScheme: body.rhyme_scheme ?? null,
      categoryId: body.category_id ?? null,
      language: body.language ?? null,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toReplyItem(reply) }, 201);
  }

  async deleteReply(c: Context, id: string) {
    const user = this.requireUser(c);
    await this.deps.deleteReply.execute({
      replyId: id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: null });
  }


  async updateReply(c: Context, id: string, body: UpdatePantunReplyBody) {
    const user = this.requireUser(c);
    const reply = await this.deps.updateReply.execute({
      replyId: id,
      actorId: user.user_id,
      lines: body.lines,
      rhymeScheme: body.rhyme_scheme ?? null,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toReplyItem(reply) });
  }

  async getReplyEditHistory(c: Context, id: string) {
    const data = await this.deps.getReplyEditHistory.execute(id);
    return c.json({ success: true as const, data });
  }

  async deletePantun(c: Context, id: string) {
    const user = this.requireUser(c);
    await this.deps.deletePantun.execute({
      id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: null });
  }

  async takedown(c: Context, id: string) {
    const user = this.requireUser(c);
    const row = await this.deps.takedown.execute({
      id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toItem(row) });
  }

  async takedownReply(c: Context, id: string) {
    const user = this.requireUser(c);
    await this.deps.takedownReply.execute({
      replyId: id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: null });
  }

  async listAdmin(c: Context, query: ListAdminPantunsQuery) {
    const page = await this.deps.listAdmin.execute({
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toItem),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  private optionalUser(c: Context): AuthUser | undefined {
    return (c as Context<{ Variables: AppVariables }>).get('user');
  }

  private requireUser(c: Context): AuthUser {
    const user = this.optionalUser(c);
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }

  private requestId(c: Context): string | undefined {
    return (c as Context<{ Variables: AppVariables }>).get('requestId');
  }
}
