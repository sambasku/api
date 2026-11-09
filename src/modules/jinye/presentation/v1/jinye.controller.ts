import type { Context } from 'hono';
import {
  BadRequestError,
  UnauthorizedError,
} from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { ImageController } from '@/modules/image/presentation/v1/image.controller';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { Jinye, JinyeComment } from '../../domain/entities/jinye.entity';
import type { CreateJinyeUseCase } from '../../application/use-cases/create-jinye.use-case';
import type { ListPublishedJinyeUseCase } from '../../application/use-cases/list-published-jinye.use-case';
import type { GetJinyeDetailUseCase } from '../../application/use-cases/get-jinye-detail.use-case';
import type { DeleteJinyeUseCase } from '../../application/use-cases/delete-jinye.use-case';
import type { AttachJinyeAudioUseCase } from '../../application/use-cases/attach-jinye-audio.use-case';
import type { CreateJinyeCommentUseCase } from '../../application/use-cases/create-jinye-comment.use-case';
import type { ListJinyeCommentsUseCase } from '../../application/use-cases/list-jinye-comments.use-case';
import type { DeleteJinyeCommentUseCase } from '../../application/use-cases/delete-jinye-comment.use-case';
import type { ArchiveJinyeUseCase } from '../../application/use-cases/archive-jinye.use-case';
import type { UnarchiveJinyeUseCase } from '../../application/use-cases/unarchive-jinye.use-case';
import type { PinJinyeUseCase } from '../../application/use-cases/pin-jinye.use-case';
import type { UnpinJinyeUseCase } from '../../application/use-cases/unpin-jinye.use-case';
import type { ListArchivedJinyeUseCase } from '../../application/use-cases/list-archived-jinye.use-case';
import type {
  CreateJinyeBody,
  CreateJinyeCommentBody,
  ListJinyeQuery,
} from './validators/jinye.validator';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toWire(
  j: Jinye,
  opts?: { exposeStaging?: boolean; isPinned?: boolean },
) {
  const published = j.status === 'published';
  const images = j.images.map((img) => {
    const hasPublic = typeof img.publicUrl === 'string' && img.publicUrl.length > 0;
    return {
      status: (hasPublic ? 'published' : 'pending_review') as
        | 'published'
        | 'pending_review',
      public_url: hasPublic ? img.publicUrl : null,
      content_warnings: hasPublic ? img.contentWarnings : [],
      ...(opts?.exposeStaging && !hasPublic
        ? { url: img.url, provider_file_id: img.providerFileId }
        : {}),
    };
  });

  const visible = published || !!opts?.exposeStaging;
  const audio =
    visible && j.audio
      ? {
          audio_url: j.audio.url,
          audio_mime_type: j.audio.mimeType,
          audio_duration_ms: j.audio.durationMs,
        }
      : null;

  return {
    id: j.id,
    user_id: j.userId,
    username: j.username,
    display_name: j.displayName,
    avatar_url: j.avatarUrl,
    is_verifier: isVerifierRole(j.userRole ?? ''),
    body: visible ? j.body : null,
    images,
    audio,
    status: j.status,
    comment_count: j.publishedCommentCount,
    repost_count: j.repostCount,
    upvotes: 0,
    downvotes: 0,
    created_at: j.createdAt.toISOString(),
    updated_at: j.updatedAt?.toISOString() ?? null,
    is_edited: !!j.isEdited,
    is_pinned: opts?.isPinned === true,
  };
}

function toCommentWire(
  c: JinyeComment,
  opts?: { exposeStaging?: boolean; includeReplies?: boolean },
) {
  const images = c.images.map((img) => {
    const hasPublic = typeof img.publicUrl === 'string' && img.publicUrl.length > 0;
    return {
      status: (hasPublic ? 'published' : 'pending_review') as
        | 'published'
        | 'pending_review',
      public_url: hasPublic ? img.publicUrl : null,
      content_warnings: hasPublic ? img.contentWarnings : [],
      ...(opts?.exposeStaging && !hasPublic
        ? { url: img.url, provider_file_id: img.providerFileId }
        : {}),
    };
  });

  return {
    id: c.id,
    jinye_id: c.jinyeId,
    parent_id: c.parentId,
    user_id: c.userId,
    username: c.username,
    display_name: c.displayName,
    avatar_url: c.avatarUrl,
    is_verifier: isVerifierRole(c.userRole ?? ''),
    body: c.body,
    images,
    status: c.status,
    created_at: c.createdAt.toISOString(),
    upvotes: 0,
    downvotes: 0,
    ...(opts?.includeReplies
      ? {
          replies: (c.replies ?? []).map((r) =>
            toCommentWire(r, { exposeStaging: opts.exposeStaging }),
          ),
        }
      : {}),
  };
}

export class JinyeController {
  constructor(
    private readonly deps: {
      create: CreateJinyeUseCase;
      listPublished: ListPublishedJinyeUseCase;
      getDetail: GetJinyeDetailUseCase;
      deleteJinye: DeleteJinyeUseCase;
      attachAudio: AttachJinyeAudioUseCase;
      createComment: CreateJinyeCommentUseCase;
      listComments: ListJinyeCommentsUseCase;
      deleteComment: DeleteJinyeCommentUseCase;
      archive: ArchiveJinyeUseCase;
      unarchive: UnarchiveJinyeUseCase;
      pin: PinJinyeUseCase;
      unpin: UnpinJinyeUseCase;
      listArchived: ListArchivedJinyeUseCase;
      imageController: ImageController;
    },
  ) {}

  uploadCredentials(c: Context<{ Variables: AppVariables }>, folder: string) {
    return this.deps.imageController.uploadCredentials(c, folder);
  }

  async create(c: Context<{ Variables: AppVariables }>, body: CreateJinyeBody) {
    const user = requireUser(c);
    const row = await this.deps.create.execute({
      userId: user.user_id,
      body: body.body,
      images: (body.images ?? []).map((i) => ({
        url: i.url,
        providerFileId: i.provider_file_id,
        publicUrl: null,
        contentWarnings: [],
      })),
      hasPendingAudio: body.has_pending_audio === true,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) }, 201);
  }

  async list(c: Context<{ Variables: AppVariables }>, q: ListJinyeQuery) {
    const page = await this.deps.listPublished.execute({
      limit: q.limit,
      cursor: q.cursor,
      userId: q.user_id,
      username: q.username,
    });
    return c.json({
      data: page.items.map((j) =>
        toWire(j, { isPinned: page.pinnedId === j.id }),
      ),
      meta: { next_cursor: page.nextCursor },
    });
  }

  async listArchived(c: Context<{ Variables: AppVariables }>, q: ListJinyeQuery) {
    const user = requireUser(c);
    const page = await this.deps.listArchived.execute({
      userId: user.user_id,
      limit: q.limit,
      cursor: q.cursor,
    });
    return c.json({
      data: page.items.map((j) => toWire(j, { exposeStaging: true })),
      meta: { next_cursor: page.nextCursor },
    });
  }

  async archive(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.archive.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) });
  }

  async unarchive(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.unarchive.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) });
  }

  async pin(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.pin.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true, isPinned: true }) });
  }

  async unpin(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.unpin.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async detail(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user');
    const roles = user?.roles ?? [];
    const viewerIsAdmin = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor'].includes(r),
    );
    const row = await this.deps.getDetail.execute({
      id,
      viewerId: user?.user_id ?? null,
      viewerIsAdmin,
    });
    const exposeStaging =
      !!user && (user.user_id === row.userId || viewerIsAdmin);
    return c.json({
      data: toWire(row, {
        exposeStaging,
        isPinned: row.isPinned,
      }),
    });
  }

  async remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.deleteJinye.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async attachAudio(c: Context<{ Variables: AppVariables }>, jinyeId: string) {
    const user = requireUser(c);
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
      jinyeId,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      requestId: c.get('requestId') ?? null,
    });

    return c.json({ data: toWire(row, { exposeStaging: true }) }, 200);
  }

  async createComment(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    body: CreateJinyeCommentBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.createComment.execute({
      jinyeId,
      userId: user.user_id,
      body: body.body,
      parentId: body.parent_id,
      images: (body.images ?? []).map((i) => ({
        url: i.url,
        providerFileId: i.provider_file_id,
        publicUrl: null,
        contentWarnings: [],
      })),
      requestId: c.get('requestId') ?? null,
    });
    return c.json(
      { data: toCommentWire(row, { exposeStaging: true }) },
      201,
    );
  }

  async listComments(c: Context<{ Variables: AppVariables }>, jinyeId: string) {
    const user = c.get('user');
    const roles = user?.roles ?? [];
    const viewerIsAdmin = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor'].includes(r),
    );
    const items = await this.deps.listComments.execute(jinyeId);
    // Staging URL hanya untuk author komen / admin (sama detail Jinye).
    const wireOne = (item: JinyeComment): ReturnType<typeof toCommentWire> =>
      toCommentWire(item, {
        exposeStaging:
          !!user && (user.user_id === item.userId || viewerIsAdmin),
        includeReplies: false,
      });

    return c.json({
      data: items.map((item) => ({
        ...wireOne(item),
        replies: (item.replies ?? []).map(wireOne),
      })),
    });
  }

  async deleteComment(
    c: Context<{ Variables: AppVariables }>,
    _jinyeId: string,
    commentId: string,
  ) {
    const user = requireUser(c);
    await this.deps.deleteComment.execute({
      id: commentId,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }
}
