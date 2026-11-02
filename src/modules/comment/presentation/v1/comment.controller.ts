import type { Context } from 'hono';
import { logger } from '@/shared/logging/logger';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { CreateCommentUseCase } from '../../application/use-cases/create-comment.use-case';
import type { CreateCommentAudioUseCase } from '../../application/use-cases/create-comment-audio.use-case';
import type { AttachCommentImageUseCase } from '../../application/use-cases/attach-comment-image.use-case';
import type { ApproveCommentImageUseCase } from '../../application/use-cases/approve-comment-image.use-case';
import type { RejectCommentImageUseCase } from '../../application/use-cases/reject-comment-image.use-case';
import type { ListWordCommentsUseCase } from '../../application/use-cases/list-word-comments.use-case';
import type { DeleteCommentUseCase } from '../../application/use-cases/delete-comment.use-case';
import type { UpdateCommentUseCase } from '../../application/use-cases/update-comment.use-case';
import type { GetCommentEditHistoryUseCase } from '../../application/use-cases/get-comment-edit-history.use-case';
import type { ListAdminCommentsUseCase } from '../../application/use-cases/list-admin-comments.use-case';
import type { TakedownCommentUseCase } from '../../application/use-cases/takedown-comment.use-case';
import type { UncensorCommentUseCase } from '../../application/use-cases/uncensor-comment.use-case';
import type { ListMyCommentsUseCase } from '../../application/use-cases/list-my-comments.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CreateUploadCredentialsUseCase } from '@/modules/image/application/use-cases/create-upload-credentials.use-case';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import type {
  ApproveCommentImageBody,
  AttachCommentImageBody,
  CreateCommentBody,
  ListAdminCommentsQueryBody,
  ListCommentsQueryBody,
  ListMyCommentsQueryBody,
  RejectCommentImageBody,
  UpdateCommentBody,
} from './validators/comment.validator';

function redactPublicBody(cm: Comment): string | null {
  return cm.status === 'published' ? (cm.body.trim().length > 0 ? cm.body : null) : null;
}

function redactPublicAudio(cm: Comment): {
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duration_ms: number | null;
} {
  if (cm.status !== 'published' || !cm.audio) {
    return {
      audio_url: null,
      audio_mime_type: null,
      audio_duration_ms: null,
    };
  }
  return {
    audio_url: cm.audio.url,
    audio_mime_type: cm.audio.mimeType,
    audio_duration_ms: cm.audio.durationMs,
  };
}

function redactPublicImage(cm: Comment) {
  if (cm.status !== 'published' || !cm.image) return null;
  const img = cm.image;
  if (img.status === 'published') {
    return {
      status: 'published' as const,
      public_url: img.publicUrl,
      content_warnings: img.contentWarnings.filter(
        (w): w is 'kekerasan' => w === 'kekerasan',
      ),
    };
  }
  if (img.status === 'pending_review') {
    return {
      status: 'pending_review' as const,
      public_url: null,
      content_warnings: [] as ('kekerasan')[],
    };
  }
  // rejected: jangan tampilkan slot ke publik
  return null;
}

function toAdminImage(cm: Comment) {
  if (!cm.image) return null;
  const img = cm.image;
  return {
    status: img.status,
    url: img.url || null,
    provider: img.provider || null,
    provider_file_id: img.providerFileId || null,
    public_url: img.publicUrl,
    content_warnings: img.contentWarnings,
    reviewed_by: img.reviewedBy,
    reviewed_at: img.reviewedAt?.toISOString() ?? null,
  };
}

function toPublicCommentFields(cm: Comment) {
  return {
    id: cm.id,
    word_id: cm.wordId,
    word_lemma: cm.wordLemma,
    user_id: cm.userId,
    username: cm.username,
    display_name: cm.displayName,
    avatar_url: cm.avatarUrl,
    is_verifier: isVerifierRole(cm.userRole ?? ''),
    body: redactPublicBody(cm),
    ...redactPublicAudio(cm),
    image: redactPublicImage(cm),
    status: cm.status,
    is_edited: cm.isEdited ?? false,
    updated_at: cm.updatedAt?.toISOString() ?? null,
    created_at: cm.createdAt.toISOString(),
  };
}

export class CommentController {
  constructor(
    private readonly deps: {
      create: CreateCommentUseCase;
      createAudio: CreateCommentAudioUseCase;
      attachImage: AttachCommentImageUseCase;
      approveImage: ApproveCommentImageUseCase;
      rejectImage: RejectCommentImageUseCase;
      listByWord: ListWordCommentsUseCase;
      delete: DeleteCommentUseCase;
      update: UpdateCommentUseCase;
      editHistory: GetCommentEditHistoryUseCase;
      listAdmin: ListAdminCommentsUseCase;
      listMine: ListMyCommentsUseCase;
      takedown: TakedownCommentUseCase;
      uncensor: UncensorCommentUseCase;
      createUploadCredentials: CreateUploadCredentialsUseCase;
    },
  ) {}

  async uploadCredentials(c: Context, folder: string) {
    const credentials = await this.deps.createUploadCredentials.execute(folder);
    return c.json({ success: true as const, data: credentials });
  }

  async create(c: Context, wordId: string, body: CreateCommentBody) {
    const actor = this.requireUser(c);
    const comment = await this.deps.create.execute({
      wordId,
      userId: actor.user_id,
      role: actor.role,
      requestId: this.requestId(c),
      body: body.body ?? '',
      image: body.image
        ? { url: body.image.url, providerFileId: body.image.provider_file_id }
        : null,
    });

    logger.info({ request_id: this.requestId(c), comment_id: comment.id, word_id: wordId }, 'comment created');

    return c.json(
      {
        success: true as const,
        data: {
          ...toPublicCommentFields(comment),
          body: comment.body.trim().length > 0 ? comment.body : null,
        },
      },
      201,
    );
  }

  async createAudio(c: Context, wordId: string) {
    const actor = this.requireUser(c);
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
    const caption = typeof body['body'] === 'string' ? body['body'] : null;

    const comment = await this.deps.createAudio.execute({
      wordId,
      userId: actor.user_id,
      role: actor.role,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      body: caption,
      durationMs: body['duration_ms'],
      requestId: this.requestId(c),
    });

    logger.info(
      { request_id: this.requestId(c), comment_id: comment.id, word_id: wordId },
      'comment audio created',
    );

    return c.json(
      {
        success: true as const,
        data: {
          ...toPublicCommentFields(comment),
          body: comment.body.trim().length > 0 ? comment.body : null,
        },
      },
      201,
    );
  }

  async listByWord(c: Context, wordId: string, query: ListCommentsQueryBody) {
    const page = await this.deps.listByWord.execute(wordId, query);
    return c.json({
      success: true as const,
      data: page.items.map((cm) => ({
        ...toPublicCommentFields(cm),
        upvotes: cm.upvotes,
        downvotes: cm.downvotes,
      })),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async delete(c: Context, id: string) {
    const actor = this.requireUser(c);
    await this.deps.delete.execute({
      commentId: id,
      actorId: actor.user_id,
      role: actor.role,
      requestId: this.requestId(c),
    });

    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment deleted by author');
    return c.json({ success: true as const, data: null });
  }

  async update(c: Context, id: string, body: UpdateCommentBody) {
    const actor = this.requireUser(c);
    const comment = await this.deps.update.execute({
      commentId: id,
      actorId: actor.user_id,
      body: body.body,
      requestId: this.requestId(c),
    });

    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment updated by author');

    return c.json({
      success: true as const,
      data: {
        ...toPublicCommentFields(comment),
        body: comment.body.trim().length > 0 ? comment.body : null,
      },
    });
  }

  async editHistory(c: Context, id: string) {
    const data = await this.deps.editHistory.execute(id);
    return c.json({ success: true as const, data });
  }

  async my(c: Context, query: ListMyCommentsQueryBody) {
    const actor = this.requireUser(c);
    const page = await this.deps.listMine.execute({
      userId: actor.user_id,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map((cm) => ({
        id: cm.id,
        word_id: cm.wordId,
        word_lemma: cm.wordLemma,
        body: cm.body,
        status: cm.status,
        created_at: cm.createdAt.toISOString(),
        reviewed_at: cm.reviewedAt ? cm.reviewedAt.toISOString() : null,
      })),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async listAdmin(c: Context, query: ListAdminCommentsQueryBody) {
    const page = await this.deps.listAdmin.execute({
      status: query.status,
      wordId: query.word_id,
      imageStatus: query.image_status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map((cm) => ({
        id: cm.id,
        word_id: cm.wordId,
        word_lemma: cm.wordLemma,
        user_id: cm.userId,
        username: cm.username,
        display_name: cm.displayName,
        avatar_url: cm.avatarUrl,
        is_verifier: isVerifierRole(cm.userRole ?? ''),
        body: cm.body,
        body_original: cm.bodyOriginal,
        is_censored: cm.bodyOriginal != null,
        image: toAdminImage(cm),
        status: cm.status,
        is_edited: cm.isEdited ?? false,
        updated_at: cm.updatedAt?.toISOString() ?? null,
        reviewed_by: cm.reviewedBy,
        reviewed_at: cm.reviewedAt ? cm.reviewedAt.toISOString() : null,
        created_at: cm.createdAt.toISOString(),
        // field wajib di commentDataSchema - audio redacted admin tetap kirim
        ...redactPublicAudio(cm),
      })),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async attachImage(c: Context, id: string, body: AttachCommentImageBody) {
    const actor = this.requireUser(c);
    const comment = await this.deps.attachImage.execute({
      commentId: id,
      userId: actor.user_id,
      url: body.url,
      providerFileId: body.provider_file_id,
      requestId: this.requestId(c),
    });
    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment image attached');
    return c.json(
      {
        success: true as const,
        data: {
          ...toPublicCommentFields(comment),
          body: comment.body.trim().length > 0 ? comment.body : null,
        },
      },
      201,
    );
  }

  async approveImage(c: Context, id: string, body: ApproveCommentImageBody) {
    const actor = this.requireUser(c);
    const comment = await this.deps.approveImage.execute({
      commentId: id,
      actorId: actor.user_id,
      contentWarnings: body.content_warnings ?? [],
      requestId: this.requestId(c),
    });

    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment image approved');
    return c.json({
      success: true as const,
      data: {
        ...toPublicCommentFields(comment),
        body: comment.body.trim().length > 0 ? comment.body : null,
      },
    });
  }

  async rejectImage(c: Context, id: string, body: RejectCommentImageBody) {
    const actor = this.requireUser(c);
    const comment = await this.deps.rejectImage.execute({
      commentId: id,
      actorId: actor.user_id,
      abusive: body.abusive === true,
      requestId: this.requestId(c),
    });
    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment image rejected');
    return c.json({
      success: true as const,
      data: {
        ...toPublicCommentFields(comment),
        body: comment.body.trim().length > 0 ? comment.body : null,
      },
    });
  }

  async takedown(c: Context, id: string) {
    const actor = this.requireUser(c);
    const reviewed = await this.deps.takedown.execute({
      commentId: id,
      reviewerId: actor.user_id,
      requestId: this.requestId(c),
    });

    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment taken down');

    return c.json({
      success: true as const,
      data: {
        id: reviewed.id,
        status: 'taken_down' as const,
        reviewed_by: reviewed.reviewedBy!,
        reviewed_at: reviewed.reviewedAt!.toISOString(),
      },
    });
  }

  async uncensor(c: Context, id: string) {
    const actor = this.requireUser(c);
    const updated = await this.deps.uncensor.execute({
      commentId: id,
      actorId: actor.user_id,
      requestId: this.requestId(c),
    });

    logger.info({ request_id: this.requestId(c), comment_id: id }, 'comment uncensored');

    return c.json({
      success: true as const,
      data: {
        id: updated.id,
        body: updated.body,
        body_original: updated.bodyOriginal,
        is_censored: false as const,
      },
    });
  }

  private requireUser(c: Context): { user_id: string; role: string } {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }

  private requestId(c: Context): string | undefined {
    return (c as Context<{ Variables: AppVariables }>).get('requestId');
  }
}
