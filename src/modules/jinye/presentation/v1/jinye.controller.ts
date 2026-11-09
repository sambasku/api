import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { CreateJinyeUseCase } from '../../application/use-cases/create-jinye.use-case';
import type { ListPublishedJinyeUseCase } from '../../application/use-cases/list-published-jinye.use-case';
import type { GetJinyeDetailUseCase } from '../../application/use-cases/get-jinye-detail.use-case';
import type { DeleteJinyeUseCase } from '../../application/use-cases/delete-jinye.use-case';
import type { CreateJinyeBody, ListJinyeQuery } from './validators/jinye.validator';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toWire(j: Jinye, opts?: { exposeStaging?: boolean }) {
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

  const audio =
    published && j.audio
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
    body: published || opts?.exposeStaging ? j.body : null,
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
  };
}

export class JinyeController {
  constructor(
    private readonly deps: {
      create: CreateJinyeUseCase;
      listPublished: ListPublishedJinyeUseCase;
      getDetail: GetJinyeDetailUseCase;
      deleteJinye: DeleteJinyeUseCase;
    },
  ) {}

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
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) }, 201);
  }

  async list(c: Context<{ Variables: AppVariables }>, q: ListJinyeQuery) {
    const page = await this.deps.listPublished.execute({
      limit: q.limit,
      cursor: q.cursor,
      userId: q.user_id,
    });
    return c.json({
      data: page.items.map((j) => toWire(j)),
      meta: { next_cursor: page.nextCursor },
    });
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
    return c.json({ data: toWire(row, { exposeStaging }) });
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
}
