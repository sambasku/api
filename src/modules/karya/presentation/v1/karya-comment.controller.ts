import type { Context } from 'hono';
import type { AppVariables, AuthUser } from '@/shared/types';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { EntityCommentBody } from '@/shared/comment/entity-comment-body.schema';
import type { UgcCommentLemmaRepository } from '@/modules/ugc-comment-lemma/domain/repositories/ugc-comment-lemma.repository';
import { attachLemmaLinksToCommentWireItems } from '@/modules/ugc-comment-lemma/presentation/enrich-comment-lemma-links';
import { entityCommentMediaWireFields } from '@/shared/comment/entity-comment-wire';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { CreateKaryaCommentAudioUseCase } from '../../application/use-cases/karya-comment-audio.use-case';
import type {
  CreateKaryaCommentUseCase,
  DeleteKaryaCommentUseCase,
  ListKaryaCommentsUseCase,
  TakedownKaryaCommentUseCase,
  UpdateKaryaCommentUseCase,
} from '../../application/use-cases/karya-comment.use-cases';
import type { KaryaComment } from '../../domain/karya-comment';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

export function toKaryaCommentWire(c: KaryaComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    karya_id: c.karyaId,
    user: {
      user_id: c.userId,
      username: deleted ? null : c.username,
      display_name: deleted ? null : c.displayName,
      avatar_url: deleted ? null : c.avatarUrl,
      is_verifier: !deleted && isVerifierRole(c.userRole ?? ''),
    },
    ...entityCommentMediaWireFields({
      status: c.status,
      body: c.body,
      stickerId: c.stickerId,
      audio: c.audio,
      image: c.image,
    }),
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

export interface KaryaCommentControllerDeps {
  listComments: ListKaryaCommentsUseCase;
  createComment: CreateKaryaCommentUseCase;
  createCommentAudio: CreateKaryaCommentAudioUseCase;
  updateComment: UpdateKaryaCommentUseCase;
  deleteComment: DeleteKaryaCommentUseCase;
  takedownComment: TakedownKaryaCommentUseCase;
  ugcLemmaLinks?: UgcCommentLemmaRepository;
}

export class KaryaCommentController {
  constructor(private readonly deps: KaryaCommentControllerDeps) {}

  private get comments(): KaryaCommentControllerDeps {
    return this.deps;
  }

  async listComments(c: Context<{ Variables: AppVariables }>) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.comments.listComments.execute(id, q.cursor, q.limit);
    return c.json({
      success: true as const,
      data: {
        items: await (async () => {
          const repo = this.comments.ugcLemmaLinks;
          if (repo) {
            return attachLemmaLinksToCommentWireItems(
              repo,
              'karya_comment',
              page.items,
              (c) => toKaryaCommentWire(c),
            );
          }
          return page.items.map((c) => ({
            ...toKaryaCommentWire(c),
            lemma_links: [] as const,
          }));
        })(),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async createComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as EntityCommentBody;
    const comment = await this.comments.createComment.execute({
      karyaId: id,
      userId: user.user_id,
      body: body.body ?? '',
      stickerId: body.sticker_id ?? null,
      image: body.image
        ? { url: body.image.url, providerFileId: body.image.provider_file_id }
        : null,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaCommentWire(comment) }, 201);
  }

  async createCommentAudio(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
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
    const comment = await this.comments.createCommentAudio.execute({
      karyaId: id,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      body: typeof body['body'] === 'string' ? body['body'] : null,
      durationMs: body['duration_ms'],
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaCommentWire(comment) }, 201);
  }

  async updateComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const updated = await this.comments.updateComment.execute({
      commentId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaCommentWire(updated) });
  }

  async deleteComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.comments.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }

  async takedownComment(c: Context<{ Variables: AppVariables }>) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.comments.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }
}
