import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { ProfileCover } from '../../domain/entities/profile-cover.entity';
import type {
  ActivateProfileCoverUseCase,
  CreateProfileCoverUseCase,
  DeleteProfileCoverUseCase,
  GetActiveProfileCoversUseCase,
  ListProfileCoversUseCase,
} from '../../application/use-cases/profile-cover.use-cases';

function toAdminWire(c: ProfileCover) {
  return {
    id: c.id,
    variant: c.variant,
    url: c.url,
    file_id: c.fileId,
    width: c.width,
    height: c.height,
    size_bytes: c.sizeBytes,
    is_active: c.isActive,
    created_by: c.createdBy,
    created_at: c.createdAt.toISOString(),
    activated_at: c.activatedAt?.toISOString() ?? null,
  };
}

export class ProfileCoverController {
  constructor(
    private readonly deps: {
      list: ListProfileCoversUseCase;
      getActive: GetActiveProfileCoversUseCase;
      create: CreateProfileCoverUseCase;
      activate: ActivateProfileCoverUseCase;
      remove: DeleteProfileCoverUseCase;
    },
  ) {}

  async listPublic(c: Context<{ Variables: AppVariables }>) {
    const active = await this.deps.getActive.execute();
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      success: true as const,
      data: {
        tab_url: active.tabUrl,
        public_url: active.publicUrl,
        wotd_url: active.wotdUrl,
      },
    });
  }

  async listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: { variant: 'tab' | 'public' | 'wotd' },
  ) {
    const items = await this.deps.list.execute(query.variant);
    return c.json({
      success: true as const,
      data: items.map(toAdminWire),
    });
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    body: {
      variant: string;
      url: string;
      file_id?: string | null;
      width: number;
      height: number;
      size_bytes?: number | null;
      activate?: boolean;
    },
  ) {
    const actorId = c.get('user')?.user_id ?? null;
    const created = await this.deps.create.execute({
      ...body,
      actorId,
    });
    return c.json({ success: true as const, data: toAdminWire(created) }, 201);
  }

  async activate(c: Context<{ Variables: AppVariables }>, id: string) {
    const actorId = c.get('user')?.user_id ?? null;
    const item = await this.deps.activate.execute(id, actorId);
    return c.json({ success: true as const, data: toAdminWire(item) });
  }

  async remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const actorId = c.get('user')?.user_id ?? null;
    await this.deps.remove.execute(id, actorId);
    return c.json({ success: true as const, data: null });
  }
}