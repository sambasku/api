import type { Context } from 'hono';
import { BadRequestError, UnauthorizedError, ValidationError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { ImageController } from '@/modules/image/presentation/v1/image.controller';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import {
  isVerifierRole,
  type Discussion,
  type DiscussionReply,
} from '../../domain/entities/discussion.entity';
import type { CreateDiscussionUseCase } from '../../application/use-cases/create-discussion.use-case';
import type { ListPublishedDiscussionsUseCase } from '../../application/use-cases/list-published-discussions.use-case';
import type { ListMyDiscussionsUseCase } from '../../application/use-cases/list-my-discussions.use-case';
import type { GetDiscussionDetailUseCase } from '../../application/use-cases/get-discussion-detail.use-case';
import type { ListAdminDiscussionsUseCase } from '../../application/use-cases/list-admin-discussions.use-case';
import type { ApproveDiscussionUseCase } from '../../application/use-cases/approve-discussion.use-case';
import type { RejectDiscussionUseCase } from '../../application/use-cases/reject-discussion.use-case';
import type { TakedownDiscussionUseCase } from '../../application/use-cases/takedown-discussion.use-case';
import type { CreateDiscussionReplyUseCase } from '../../application/use-cases/create-discussion-reply.use-case';
import type { CreateDiscussionReplyAudioUseCase } from '../../application/use-cases/create-discussion-reply-audio.use-case';
import type { AttachDiscussionAudioUseCase } from '../../application/use-cases/attach-discussion-audio.use-case';
import type { DeleteDiscussionReplyUseCase } from '../../application/use-cases/delete-discussion-reply.use-case';
import type { PinDiscussionReplyUseCase } from '../../application/use-cases/pin-discussion-reply.use-case';
import type { TakedownDiscussionReplyUseCase } from '../../application/use-cases/takedown-discussion-reply.use-case';
import type {
  CreateDiscussionBody,
  CreateDiscussionReplyBody,
  ListAdminDiscussionsQuery,
  ListMyDiscussionsQuery,
  ListDiscussionsQuery,
  PinDiscussionReplyBody,
  RejectDiscussionBody,
} from './validators/discussion.validator';

function redactReplyBody(reply: DiscussionReply): string | null {
  if (reply.status !== 'published') return null;
  const trimmed = reply.body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function redactReplyAudio(reply: DiscussionReply): {
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duration_ms: number | null;
} {
  if (reply.status !== 'published' || !reply.audio) {
    return {
      audio_url: null,
      audio_mime_type: null,
      audio_duration_ms: null,
    };
  }
  return {
    audio_url: reply.audio.url,
    audio_mime_type: reply.audio.mimeType,
    audio_duration_ms: reply.audio.durationMs,
  };
}

function redactDiscussionAudio(
  help: Discussion,
  opts: { expose: boolean },
): {
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duration_ms: number | null;
} {
  if (!opts.expose || !help.audio) {
    return {
      audio_url: null,
      audio_mime_type: null,
      audio_duration_ms: null,
    };
  }
  return {
    audio_url: help.audio.url,
    audio_mime_type: help.audio.mimeType,
    audio_duration_ms: help.audio.durationMs,
  };
}

function toPublicImages(help: Discussion) {
  return help.images
    .filter((img) => img.publicUrl)
    .map((img) => ({
      public_url: img.publicUrl as string,
      content_warnings: img.contentWarnings ?? [],
    }));
}

function toOwnerImages(help: Discussion) {
  return help.images.map((img) => ({
    url: img.url,
    provider_file_id: img.providerFileId,
    public_url: img.publicUrl,
    content_warnings: img.contentWarnings ?? [],
  }));
}

function toAdminImages(help: Discussion) {
  return toOwnerImages(help);
}

export function toPublicItem(help: Discussion & { upvotes?: number }) {
  return {
    id: help.id,
    user_id: help.userId,
    username: help.username,
    display_name: help.displayName,
    avatar_url: help.avatarUrl,
    body: help.body,
    link_url: help.linkUrl,
    images: toPublicImages(help),
    ...redactDiscussionAudio(help, { expose: help.status === 'published' }),
    status: 'published' as const,
    pinned_reply_id: help.pinnedReplyId,
    upvotes: help.upvotes ?? 0,
    created_at: help.createdAt.toISOString(),
  };
}

export function toOwnerItem(help: Discussion & { upvotes?: number }) {
  return {
    id: help.id,
    user_id: help.userId,
    username: help.username,
    display_name: help.displayName,
    avatar_url: help.avatarUrl,
    body: help.body,
    link_url: help.linkUrl,
    images: toOwnerImages(help),
    ...redactDiscussionAudio(help, {
      expose: help.status === 'published' || help.status === 'pending_review',
    }),
    status: help.status,
    rejection_note: help.rejectionNote,
    pinned_reply_id: help.pinnedReplyId,
    reviewed_at: help.reviewedAt?.toISOString() ?? null,
    upvotes: help.upvotes ?? 0,
    created_at: help.createdAt.toISOString(),
    updated_at: help.updatedAt?.toISOString() ?? null,
  };
}

export function toAdminItem(help: Discussion & { upvotes?: number }) {
  return {
    id: help.id,
    user_id: help.userId,
    username: help.username,
    display_name: help.displayName,
    avatar_url: help.avatarUrl,
    body: help.body,
    link_url: help.linkUrl,
    images: toAdminImages(help),
    ...redactDiscussionAudio(help, { expose: true }),
    status: help.status,
    rejection_note: help.rejectionNote,
    reviewed_by: help.reviewedBy,
    reviewed_at: help.reviewedAt?.toISOString() ?? null,
    pinned_reply_id: help.pinnedReplyId,
    upvotes: help.upvotes ?? 0,
    created_at: help.createdAt.toISOString(),
    updated_at: help.updatedAt?.toISOString() ?? null,
  };
}

function toPublicReply(
  reply: DiscussionReply & { upvotes?: number; downvotes?: number },
  pinnedReplyId: string | null,
) {
  return {
    id: reply.id,
    user_id: reply.userId,
    username: reply.username,
    display_name: reply.displayName,
    avatar_url: reply.avatarUrl,
    body: redactReplyBody(reply),
    ...redactReplyAudio(reply),
    status: reply.status,
    is_verifier: isVerifierRole(reply.userRole),
    is_pinned: pinnedReplyId === reply.id,
    upvotes: reply.upvotes ?? 0,
    downvotes: reply.downvotes ?? 0,
    created_at: reply.createdAt.toISOString(),
  };
}

function toAdminReply(
  reply: DiscussionReply & { upvotes?: number; downvotes?: number },
  pinnedReplyId: string | null,
) {
  return {
    ...toPublicReply(reply, pinnedReplyId),
    body: reply.body,
    body_original: reply.bodyOriginal,
    is_censored: reply.bodyOriginal != null,
    reviewed_by: reply.reviewedBy,
    reviewed_at: reply.reviewedAt?.toISOString() ?? null,
  };
}

async function parseApprovePayload(c: Context): Promise<{
  files: Uint8Array[];
  mimeTypes: (string | null)[];
  imageContentWarnings: string[][] | null;
}> {
  const contentType = c.req.header('content-type') ?? '';

  if (contentType.includes('application/json')) {
    let json: unknown = {};
    try {
      json = await c.req.json();
    } catch {
      json = {};
    }
    const warnings = extractContentWarningsField(
      json && typeof json === 'object' && json !== null
        ? (json as Record<string, unknown>).content_warnings
        : undefined,
    );
    return { files: [], mimeTypes: [], imageContentWarnings: warnings };
  }

  if (!contentType.includes('multipart/form-data')) {
    return { files: [], mimeTypes: [], imageContentWarnings: null };
  }

  const body = await c.req.parseBody({ all: true });
  const files: Uint8Array[] = [];
  const mimeTypes: (string | null)[] = [];

  const collect = async (part: unknown) => {
    if (!part || typeof part === 'string') {
      // Slot teks kosong / placeholder - treat as empty file
      files.push(new Uint8Array(0));
      mimeTypes.push(null);
      return;
    }
    const file = part as File;
    files.push(new Uint8Array(await file.arrayBuffer()));
    mimeTypes.push(file.type || null);
  };

  // file_0, file_1, ... lalu fallback single `file`
  let idx = 0;
  let sawIndexed = false;
  while (true) {
    const key = `file_${idx}`;
    if (!(key in body)) break;
    sawIndexed = true;
    await collect(body[key]);
    idx += 1;
  }

  if (!sawIndexed && 'file' in body) {
    const part = body['file'];
    if (Array.isArray(part)) {
      for (const item of part) await collect(item);
    } else {
      await collect(part);
    }
  }

  const rawWarnings = body['content_warnings'];
  let warningsField: unknown = rawWarnings;
  if (typeof rawWarnings === 'string') {
    try {
      warningsField = JSON.parse(rawWarnings);
    } catch {
      throw new ValidationError([
        { field: 'content_warnings', message: 'content_warnings harus JSON array' },
      ]);
    }
  }

  return {
    files,
    mimeTypes,
    imageContentWarnings: extractContentWarningsField(warningsField),
  };
}

function extractContentWarningsField(raw: unknown): string[][] | null {
  if (raw == null || raw === '') return null;
  if (!Array.isArray(raw)) {
    throw new ValidationError([
      { field: 'content_warnings', message: 'content_warnings harus berupa array' },
    ]);
  }
  return raw.map((slot) => {
    if (!Array.isArray(slot)) {
      throw new ValidationError([
        { field: 'content_warnings', message: 'Setiap entri content_warnings harus berupa array' },
      ]);
    }
    return slot.map((w) => String(w));
  });
}

export class DiscussionController {
  constructor(
    private readonly deps: {
      create: CreateDiscussionUseCase;
      listPublished: ListPublishedDiscussionsUseCase;
      listMine: ListMyDiscussionsUseCase;
      getDetail: GetDiscussionDetailUseCase;
      listAdmin: ListAdminDiscussionsUseCase;
      approve: ApproveDiscussionUseCase;
      reject: RejectDiscussionUseCase;
      takedown: TakedownDiscussionUseCase;
      createReply: CreateDiscussionReplyUseCase;
      createReplyAudio: CreateDiscussionReplyAudioUseCase;
      attachAudio: AttachDiscussionAudioUseCase;
      deleteReply: DeleteDiscussionReplyUseCase;
      pinReply: PinDiscussionReplyUseCase;
      takedownReply: TakedownDiscussionReplyUseCase;
      imageController: ImageController;
    },
  ) {}

  uploadCredentials(c: Context, folder: string) {
    return this.deps.imageController.uploadCredentials(c, folder);
  }

  async create(c: Context, body: CreateDiscussionBody) {
    const user = this.requireUser(c);
    const row = await this.deps.create.execute({
      userId: user.user_id,
      body: body.body,
      linkUrl: body.link_url ?? null,
      images: (body.images ?? []).map((img) => ({
        url: img.url,
        providerFileId: img.provider_file_id,
        publicUrl: null,
        contentWarnings: [],
      })),
      requestId: this.requestId(c),
    });
    return c.json(
      {
        success: true as const,
        data: {
          id: row.id,
          status: 'pending_review' as const,
          submitted_at: row.createdAt.toISOString(),
        },
      },
      200,
    );
  }

  async listPublished(c: Context, query: ListDiscussionsQuery) {
    const page = await this.deps.listPublished.execute({
      limit: query.limit,
      cursor: query.cursor,
      sort: query.sort,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toPublicItem),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async listMine(c: Context, query: ListMyDiscussionsQuery) {
    const user = this.requireUser(c);
    const page = await this.deps.listMine.execute({
      userId: user.user_id,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toOwnerItem),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async getDetail(c: Context, id: string) {
    const user = this.optionalUser(c);
    const { discussion: help, replies } = await this.deps.getDetail.execute({
      id,
      viewerUserId: user?.user_id ?? null,
    });

    const isOwner = user?.user_id === help.userId;
    if (help.status === 'published') {
      return c.json({
        success: true as const,
        data: {
          ...toPublicItem(help),
          replies: replies.map((r) => toPublicReply(r, help.pinnedReplyId)),
        },
      });
    }

    // Owner view (pending / rejected / taken_down)
    if (!isOwner) {
      // use-case already 404s; defensive
      throw new ValidationError([{ field: 'id', message: 'Diskusi tidak ditemukan' }]);
    }

    return c.json({
      success: true as const,
      data: {
        ...toOwnerItem(help),
        replies: replies.map((r) => toPublicReply(r, help.pinnedReplyId)),
      },
    });
  }

  async listAdmin(c: Context, query: ListAdminDiscussionsQuery) {
    const page = await this.deps.listAdmin.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toAdminItem),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async getAdminDetail(c: Context, id: string) {
    const { discussion: help, replies } = await this.deps.getDetail.execute({ id, asAdmin: true });
    return c.json({
      success: true as const,
      data: {
        ...toAdminItem(help),
        replies: replies.map((r) => toAdminReply(r, help.pinnedReplyId)),
      },
    });
  }

  async approve(c: Context, id: string) {
    const user = this.requireUser(c);
    const { files, mimeTypes, imageContentWarnings } = await parseApprovePayload(c);
    const row = await this.deps.approve.execute({
      id,
      actorId: user.user_id,
      censoredFiles: files.length > 0 ? files : undefined,
      censoredMimeTypes: mimeTypes.length > 0 ? mimeTypes : undefined,
      imageContentWarnings,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toAdminItem(row) });
  }

  async reject(c: Context, id: string, body: RejectDiscussionBody) {
    const user = this.requireUser(c);
    const row = await this.deps.reject.execute({
      id,
      actorId: user.user_id,
      note: body.note,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toAdminItem(row) });
  }

  async takedown(c: Context, id: string) {
    const user = this.requireUser(c);
    const row = await this.deps.takedown.execute({
      id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toAdminItem(row) });
  }

  async createReply(c: Context, discussionId: string, body: CreateDiscussionReplyBody) {
    const user = this.requireUser(c);
    const reply = await this.deps.createReply.execute({
      discussionId,
      userId: user.user_id,
      body: body.body,
      requestId: this.requestId(c),
    });
    const help = await this.deps.getDetail.execute({
      id: discussionId,
      viewerUserId: user.user_id,
    });
    return c.json(
      {
        success: true as const,
        data: toPublicReply(reply, help.discussion.pinnedReplyId),
      },
      201,
    );
  }

  async createReplyAudio(c: Context, discussionId: string) {
    const user = this.requireUser(c);
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
      throw new BadRequestError('AUDIO_TOO_LARGE', 'File audio terlalu besar (maks 5 MB)', [
        { field: 'audio', message: 'Ukuran maksimal 5 MB' },
      ]);
    }

    const body = await c.req.parseBody({ all: true });
    const audioPart = body['audio'];
    if (!audioPart || typeof audioPart === 'string') {
      throw new BadRequestError('VALIDATION_ERROR', 'File audio wajib diunggah', [
        { field: 'audio', message: 'Field multipart `audio` wajib berisi file' },
      ]);
    }

    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const caption =
      typeof body['body'] === 'string' ? body['body'] : null;

    const reply = await this.deps.createReplyAudio.execute({
      discussionId,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      body: caption,
      durationMs: body['duration_ms'],
      requestId: this.requestId(c),
    });

    const help = await this.deps.getDetail.execute({
      id: discussionId,
      viewerUserId: user.user_id,
    });
    return c.json(
      {
        success: true as const,
        data: toPublicReply(reply, help.discussion.pinnedReplyId),
      },
      201,
    );
  }

  async attachAudio(c: Context, discussionId: string) {
    const user = this.requireUser(c);
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
      throw new BadRequestError('AUDIO_TOO_LARGE', 'File audio terlalu besar (maks 5 MB)', [
        { field: 'audio', message: 'Ukuran maksimal 5 MB' },
      ]);
    }

    const body = await c.req.parseBody({ all: true });
    const audioPart = body['audio'];
    if (!audioPart || typeof audioPart === 'string') {
      throw new BadRequestError('VALIDATION_ERROR', 'File audio wajib diunggah', [
        { field: 'audio', message: 'Field multipart `audio` wajib berisi file' },
      ]);
    }

    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const row = await this.deps.attachAudio.execute({
      discussionId,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      requestId: this.requestId(c),
    });

    return c.json({ success: true as const, data: toOwnerItem(row) }, 200);
  }

  async deleteReply(c: Context, replyId: string) {
    const user = this.requireUser(c);
    await this.deps.deleteReply.execute({
      replyId,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: null });
  }

  async pinReply(c: Context, discussionId: string, body: PinDiscussionReplyBody) {
    const user = this.requireUser(c);
    const row = await this.deps.pinReply.execute({
      discussionId,
      replyId: body.reply_id,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toAdminItem(row) });
  }

  async takedownReply(c: Context, replyId: string) {
    const user = this.requireUser(c);
    const reply = await this.deps.takedownReply.execute({
      replyId,
      reviewerId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({
      success: true as const,
      data: toAdminReply(reply, null),
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
