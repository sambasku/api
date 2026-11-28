import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { entityCommentMediaWireFields } from '@/shared/comment/entity-comment-wire';
import type { AppVariables } from '@/shared/types';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { UgcCommentLemmaRepository } from '@/modules/ugc-comment-lemma/domain/repositories/ugc-comment-lemma.repository';
import { attachLemmaLinksToNestedCommentWireItems } from '@/modules/ugc-comment-lemma/presentation/enrich-comment-lemma-links';
import type {
  CreatePhotoCommentUseCase,
  DeletePhotoCommentUseCase,
  ListPhotoCommentsUseCase,
  TakedownPhotoCommentUseCase,
  UpdatePhotoCommentUseCase,
} from '../../application/use-cases/photo-comment.use-cases';
import type {
  PhotoComment,
  PhotoCommentKind,
} from '../../domain/entities/photo-comment.entity';

type Ctx = Context<{ Variables: AppVariables }>;

function requireUser(c: Ctx) {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

export function toPhotoCommentWire(c: PhotoComment) {
  const deleted = c.authorDeletedAt !== null;
  return {
    id: c.id,
    photo_kind: c.photoKind,
    photo_ref: c.photoRef,
    parent_id: c.parentId ?? null,
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
      stickerId: null,
      audio: null,
      image: null,
    }),
    status: c.status,
    is_edited: c.isEdited,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt?.toISOString() ?? null,
  };
}

export interface PhotoCommentControllerDeps {
  listComments: ListPhotoCommentsUseCase;
  createComment: CreatePhotoCommentUseCase;
  updateComment: UpdatePhotoCommentUseCase;
  deleteComment: DeletePhotoCommentUseCase;
  takedownComment: TakedownPhotoCommentUseCase;
  ugcLemmaLinks?: UgcCommentLemmaRepository;
}

export class PhotoCommentController {
  constructor(private readonly deps: PhotoCommentControllerDeps) {}

  async listComments(c: Ctx) {
    const { kind, ref } = c.req.valid('param' as never) as {
      kind: PhotoCommentKind;
      ref: string;
    };
    const q = c.req.valid('query' as never) as { cursor?: string; limit: number };
    const page = await this.deps.listComments.execute(kind, ref, q.cursor, q.limit);
    const items = await attachLemmaLinksToNestedCommentWireItems(
      this.deps.ugcLemmaLinks,
      'photo_comment',
      page.items,
      (item) => toPhotoCommentWire(item),
    );
    return c.json({
      success: true as const,
      data: { items, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  async commentCounts(c: Ctx) {
    const q = c.req.valid('query' as never) as {
      kind: PhotoCommentKind;
      refs: string[];
    };
    const counts = await this.deps.listComments.countByPhotos(q.kind, q.refs);
    return c.json({ success: true as const, data: { counts } });
  }

  async createComment(c: Ctx) {
    const user = requireUser(c);
    const { kind, ref } = c.req.valid('param' as never) as {
      kind: PhotoCommentKind;
      ref: string;
    };
    const body = c.req.valid('json' as never) as {
      body: string;
      parent_id?: string | null;
    };
    const comment = await this.deps.createComment.execute({
      kind,
      ref,
      parentId: body.parent_id ?? null,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toPhotoCommentWire(comment) }, 201);
  }

  async getCommentEditHistory(c: Ctx) {
    const { id } = c.req.valid('param' as never) as { id: string };
    const data = await this.deps.listComments.getEditHistory(id);
    return c.json({ success: true as const, data });
  }

  async updateComment(c: Ctx) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    const body = c.req.valid('json' as never) as { body: string };
    const updated = await this.deps.updateComment.execute({
      commentId: id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toPhotoCommentWire(updated) });
  }

  async deleteComment(c: Ctx) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.deps.deleteComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }

  async takedownComment(c: Ctx) {
    const user = requireUser(c);
    const { id } = c.req.valid('param' as never) as { id: string };
    await this.deps.takedownComment.execute(id, user.user_id);
    return c.json({ success: true as const, data: null });
  }
}
