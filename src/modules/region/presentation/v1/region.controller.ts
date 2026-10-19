import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Region } from '../../domain/entities/region.entity';
import type {
  CreateRegionUseCase,
  DeleteRegionUseCase,
  GetRegionByIdUseCase,
  ListRegionsUseCase,
  UpdateRegionUseCase,
} from '../../application/use-cases/region.use-cases';
import type { z } from 'zod';
import type {
  createRegionBodySchema,
  listRegionsQuerySchema,
  updateRegionBodySchema,
} from './validators/region.validator';

function serialize(r: Region) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    parent_id: r.parentId,
    code: r.code,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    sort_order: r.sortOrder,
    created_at: Math.floor(r.createdAt.getTime() / 1000),
    updated_at: r.updatedAt ? Math.floor(r.updatedAt.getTime() / 1000) : null,
  };
}

export class RegionController {
  constructor(
    private readonly createUc: CreateRegionUseCase,
    private readonly updateUc: UpdateRegionUseCase,
    private readonly deleteUc: DeleteRegionUseCase,
    private readonly listUc: ListRegionsUseCase,
    private readonly getByIdUc: GetRegionByIdUseCase,
  ) {}

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listRegionsQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        type: query.type,
        parentId: query.parent_id,
        q: query.q,
        publicOnly: true,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  getById(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.getByIdUc
      .execute(id, true)
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listRegionsQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        type: query.type,
        parentId: query.parent_id,
        q: query.q,
        status: query.status,
        publicOnly: false,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createRegionBodySchema>,
  ) {
    return this.createUc
      .execute({
        id: body.id,
        name: body.name,
        type: body.type,
        parentId: body.parent_id ?? null,
        code: body.code ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        status: body.status,
        sortOrder: body.sort_order,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateRegionBodySchema>,
  ) {
    return this.updateUc
      .execute({
        id,
        name: body.name,
        parentId: body.parent_id,
        code: body.code,
        lat: body.lat,
        lng: body.lng,
        status: body.status,
        sortOrder: body.sort_order,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }
}
