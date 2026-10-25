import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  MobileRelease,
  MobileReleasePlatform,
} from '../../domain/entities/mobile-release.entity';
import type {
  GetLatestMobileReleaseUseCase,
  ListMobileReleasesUseCase,
  UpsertMobileReleaseUseCase,
} from '../../application/use-cases/mobile-release.use-cases';
import type { GetLatestQuery, UpsertBody } from './validators/mobile-release.validator';

type Ctx = Context<{ Variables: AppVariables }>;

function toWire(row: MobileRelease) {
  return {
    id: row.id,
    platform: row.platform,
    version: row.version,
    store_url: row.storeUrl,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export class MobileReleaseController {
  constructor(
    private readonly deps: {
      getLatest: GetLatestMobileReleaseUseCase;
      list: ListMobileReleasesUseCase;
      upsert: UpsertMobileReleaseUseCase;
    },
  ) {}

  async getLatest(c: Ctx, query: GetLatestQuery) {
    const row = await this.deps.getLatest.execute(query.platform);
    return c.json({ success: true as const, data: row ? toWire(row) : null });
  }

  async list(c: Ctx) {
    const rows = await this.deps.list.execute();
    return c.json({ success: true as const, data: rows.map(toWire) });
  }

  async upsert(c: Ctx, platform: MobileReleasePlatform, body: UpsertBody) {
    const user = this.requireUser(c);
    const row = await this.deps.upsert.execute({
      platform,
      version: body.version,
      storeUrl: body.store_url,
      notes: body.notes,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toWire(row) });
  }

  private requireUser(c: Ctx): AuthUser {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError();
    return user;
  }
}
