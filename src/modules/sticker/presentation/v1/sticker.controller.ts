import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Sticker } from '../../domain/entities/sticker.entity';
import type {
  CreateStickerUseCase,
  DeleteStickerUseCase,
  GetActiveStickerUseCase,
  ListActiveStickersUseCase,
  ListAdminStickersUseCase,
  UpdateStickerUseCase,
} from '../../application/use-cases/sticker.use-cases';

function toPublicWire(s: Sticker) {
  return {
    id: s.id,
    image_url: s.imageUrl,
    play_once: s.playOnce,
    category_slug: s.categorySlug,
  };
}

function toAdminWire(s: Sticker) {
  return {
    ...toPublicWire(s),
    sort_order: s.sortOrder,
    is_active: s.isActive,
  };
}

export class StickerController {
  constructor(
    private readonly deps: {
      listActive: ListActiveStickersUseCase;
      getActive: GetActiveStickerUseCase;
      listAdmin: ListAdminStickersUseCase;
      create: CreateStickerUseCase;
      update: UpdateStickerUseCase;
      remove: DeleteStickerUseCase;
    },
  ) {}

  async listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: {
      q?: string;
      category_slug?: string;
      limit?: number;
      cursor?: string;
    },
  ) {
    const page = await this.deps.listActive.execute({
      q: query.q,
      categorySlug: query.category_slug,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toPublicWire),
      meta: {
        next_cursor: page.nextCursor,
        categories: page.categories,
      },
    });
  }

  async getPublic(c: Context<{ Variables: AppVariables }>, id: string) {
    const item = await this.deps.getActive.execute(id);
    return c.json({ success: true as const, data: toPublicWire(item) });
  }

  async listAdmin(c: Context<{ Variables: AppVariables }>) {
    const items = await this.deps.listAdmin.execute();
    return c.json({ success: true as const, data: items.map(toAdminWire) });
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    body: {
      id: string;
      image_url: string;
      play_once?: boolean;
      sort_order?: number;
      is_active?: boolean;
      category_slug?: string | null;
    },
  ) {
    const user = c.get('user');
    const created = await this.deps.create.execute({
      id: body.id,
      imageUrl: body.image_url,
      playOnce: body.play_once,
      sortOrder: body.sort_order,
      isActive: body.is_active,
      categorySlug: body.category_slug,
      actorId: user!.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: toAdminWire(created) }, 201);
  }

  async update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: {
      image_url?: string;
      play_once?: boolean;
      sort_order?: number;
      is_active?: boolean;
      category_slug?: string | null;
    },
  ) {
    const user = c.get('user');
    const updated = await this.deps.update.execute({
      id,
      imageUrl: body.image_url,
      playOnce: body.play_once,
      sortOrder: body.sort_order,
      isActive: body.is_active,
      categorySlug: body.category_slug,
      actorId: user!.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: toAdminWire(updated) });
  }

  async remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user');
    await this.deps.remove.execute({
      id,
      actorId: user!.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: null });
  }
}
