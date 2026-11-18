import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Sticker } from '../../domain/entities/sticker.entity';
import type {
  CreateStickerUseCase,
  DeleteStickerUseCase,
  ListActiveStickersUseCase,
  ListAdminStickersUseCase,
  UpdateStickerUseCase,
} from '../../application/use-cases/sticker.use-cases';

function toWire(s: Sticker) {
  return {
    id: s.id,
    image_url: s.imageUrl,
    play_once: s.playOnce,
    sort_order: s.sortOrder,
    is_active: s.isActive,
  };
}

export class StickerController {
  constructor(
    private readonly deps: {
      listActive: ListActiveStickersUseCase;
      listAdmin: ListAdminStickersUseCase;
      create: CreateStickerUseCase;
      update: UpdateStickerUseCase;
      remove: DeleteStickerUseCase;
    },
  ) {}

  async listPublic(c: Context<{ Variables: AppVariables }>) {
    const items = await this.deps.listActive.execute();
    return c.json({
      success: true as const,
      data: items.map((s) => ({
        id: s.id,
        image_url: s.imageUrl,
        play_once: s.playOnce,
      })),
    });
  }

  async listAdmin(c: Context<{ Variables: AppVariables }>) {
    const items = await this.deps.listAdmin.execute();
    return c.json({ success: true as const, data: items.map(toWire) });
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    body: {
      id: string;
      image_url: string;
      play_once?: boolean;
      sort_order?: number;
      is_active?: boolean;
    },
  ) {
    const user = c.get('user');
    const created = await this.deps.create.execute({
      id: body.id,
      imageUrl: body.image_url,
      playOnce: body.play_once,
      sortOrder: body.sort_order,
      isActive: body.is_active,
      actorId: user!.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: toWire(created) }, 201);
  }

  async update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: {
      image_url?: string;
      play_once?: boolean;
      sort_order?: number;
      is_active?: boolean;
    },
  ) {
    const user = c.get('user');
    const updated = await this.deps.update.execute({
      id,
      imageUrl: body.image_url,
      playOnce: body.play_once,
      sortOrder: body.sort_order,
      isActive: body.is_active,
      actorId: user!.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: toWire(updated) });
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
