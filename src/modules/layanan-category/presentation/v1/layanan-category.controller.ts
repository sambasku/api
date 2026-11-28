import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import type { LayananCategoryRecord } from '../../domain/entities/layanan-category.entity';
import type {
  CreateLayananCategoryUseCase,
  DeleteLayananCategoryUseCase,
  ListLayananCategoriesUseCase,
  UpdateLayananCategoryUseCase,
} from '../../application/use-cases/layanan-category.use-cases';
import type {
  createLayananCategoryBodySchema,
  listLayananCategoriesQuerySchema,
  updateLayananCategoryBodySchema,
} from './validators/layanan-category.validator';

function serialize(r: LayananCategoryRecord) {
  return {
    id: r.id,
    name: r.name,
    short_label: r.shortLabel,
    icon: r.icon,
    status: r.status,
    sort_order: r.sortOrder,
    created_at: Math.floor(r.createdAt.getTime() / 1000),
    updated_at: r.updatedAt ? Math.floor(r.updatedAt.getTime() / 1000) : null,
  };
}

export class LayananCategoryController {
  constructor(
    private readonly createUc: CreateLayananCategoryUseCase,
    private readonly updateUc: UpdateLayananCategoryUseCase,
    private readonly deleteUc: DeleteLayananCategoryUseCase,
    private readonly listUc: ListLayananCategoriesUseCase,
  ) {}

  listPublic(c: Context<{ Variables: AppVariables }>) {
    return this.listUc
      .execute({ publicOnly: true })
      .then((items) => c.json({ success: true as const, data: { items: items.map(serialize) } }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listLayananCategoriesQuerySchema>,
  ) {
    return this.listUc
      .execute({ publicOnly: false, status: query.status })
      .then((items) => c.json({ success: true as const, data: { items: items.map(serialize) } }));
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createLayananCategoryBodySchema>,
  ) {
    return this.createUc
      .execute({
        id: body.id,
        name: body.name,
        shortLabel: body.short_label,
        icon: body.icon ?? 'siren',
        status: body.status,
        sortOrder: body.sort_order,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateLayananCategoryBodySchema>,
  ) {
    return this.updateUc
      .execute({
        id,
        name: body.name,
        shortLabel: body.short_label,
        icon: body.icon,
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
