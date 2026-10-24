import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { UsahaCategoryRecord } from '../../domain/entities/usaha-category.entity';
import type {
  CreateUsahaCategoryUseCase,
  DeleteUsahaCategoryUseCase,
  GetUsahaCategoryUseCase,
  ListUsahaCategoriesUseCase,
  UpdateUsahaCategoryUseCase,
} from '../../application/use-cases/usaha-category.use-cases';
import type { z } from 'zod';
import type {
  createUsahaCategoryBodySchema,
  listUsahaCategoriesQuerySchema,
  updateUsahaCategoryBodySchema,
} from './validators/usaha-category.validator';

function serialize(r: UsahaCategoryRecord) {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    sort_order: r.sortOrder,
    created_at: Math.floor(r.createdAt.getTime() / 1000),
    updated_at: r.updatedAt ? Math.floor(r.updatedAt.getTime() / 1000) : null,
  };
}

export class UsahaCategoryController {
  constructor(
    private readonly createUc: CreateUsahaCategoryUseCase,
    private readonly updateUc: UpdateUsahaCategoryUseCase,
    private readonly deleteUc: DeleteUsahaCategoryUseCase,
    private readonly listUc: ListUsahaCategoriesUseCase,
    private readonly getByIdUc: GetUsahaCategoryUseCase,
  ) {}

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listUsahaCategoriesQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
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
    query: z.infer<typeof listUsahaCategoriesQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
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
    body: z.infer<typeof createUsahaCategoryBodySchema>,
  ) {
    return this.createUc
      .execute({
        id: body.id,
        name: body.name,
        status: body.status,
        sortOrder: body.sort_order,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateUsahaCategoryBodySchema>,
  ) {
    return this.updateUc
      .execute({
        id,
        name: body.name,
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
