import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { Pantun, PantunReply } from '../../domain/entities/pantun.entity';
import type { CreatePantunUseCase } from '../../application/use-cases/create-pantun.use-case';
import type { CreatePantunReplyUseCase } from '../../application/use-cases/create-pantun-reply.use-case';
import type { ListPublishedPantunsUseCase } from '../../application/use-cases/list-published-pantuns.use-case';
import type { GetPantunDetailUseCase } from '../../application/use-cases/get-pantun-detail.use-case';
import type { TakedownPantunUseCase } from '../../application/use-cases/takedown-pantun.use-case';
import type { TakedownPantunReplyUseCase } from '../../application/use-cases/takedown-pantun-reply.use-case';
import type { DeletePantunReplyUseCase } from '../../application/use-cases/delete-pantun-reply.use-case';
import type { ListAdminPantunsUseCase } from '../../application/use-cases/list-admin-pantuns.use-case';
import type {
  CreatePantunBody,
  CreatePantunReplyBody,
  ListPantunsQuery,
  ListAdminPantunsQuery,
} from './validators/pantun.validator';

function toItem(p: Pantun) {
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
    rhyme_scheme: p.rhymeScheme,
    lines: p.lines,
    status: p.status,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt?.toISOString() ?? null,
  };
}

function toReplyItem(r: PantunReply) {
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
    rhyme_scheme: r.rhymeScheme,
    lines: r.status === 'published' ? r.lines : [],
    status: r.status,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt?.toISOString() ?? null,
  };
}

export class PantunController {
  constructor(
    private readonly deps: {
      create: CreatePantunUseCase;
      createReply: CreatePantunReplyUseCase;
      listPublished: ListPublishedPantunsUseCase;
      getDetail: GetPantunDetailUseCase;
      takedown: TakedownPantunUseCase;
      takedownReply: TakedownPantunReplyUseCase;
      deleteReply: DeletePantunReplyUseCase;
      listAdmin: ListAdminPantunsUseCase;
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
