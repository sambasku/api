import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Category } from '../../domain/entities/category.entity';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  UpdateCategoryUseCase,
} from '../../application/use-cases/category.use-cases';

function serialize(c: Category) {
  return {
    id: c.id,
    parent_id: c.parentId,
    name: c.name,
    description: c.description,
    word_count: c.wordCount ?? 0,
  };
}

export class CategoryController {
  constructor(
    private readonly deps: {
      listCategories: ListCategoriesUseCase;
      createCategory: CreateCategoryUseCase;
      updateCategory: UpdateCategoryUseCase;
      deleteCategory: DeleteCategoryUseCase;
    },
  ) {}

  async categories(c: Context) {
    const items = await this.deps.listCategories.execute();
    return c.json({
      success: true as const,
      data: items.map(serialize),
    });
  }

  createCategory(
    c: Context<{ Variables: AppVariables }>,
    body: { name: string; description?: string | null; parent_id?: string | null },
  ) {
    const user = c.get('user')!;
    return this.deps.createCategory
      .execute({
        name: body.name,
        description: body.description ?? null,
        parentId: body.parent_id ?? null,
        actorId: user.user_id,
        requestId: c.get('requestId'),
      })
      .then((cat) => c.json({ success: true as const, data: serialize(cat) }, 201));
  }

  updateCategory(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { name?: string; description?: string | null; parent_id?: string | null },
  ) {
    const user = c.get('user')!;
    return this.deps.updateCategory
      .execute({
        id,
        name: body.name,
        description: body.description,
        parentId: body.parent_id,
        actorId: user.user_id,
        requestId: c.get('requestId'),
      })
      .then((cat) => c.json({ success: true as const, data: serialize(cat) }, 200));
  }

  deleteCategory(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user')!;
    return this.deps.deleteCategory
      .execute({ id, actorId: user.user_id, requestId: c.get('requestId') })
      .then(() => c.json({ success: true as const, data: null }, 200));
  }
}