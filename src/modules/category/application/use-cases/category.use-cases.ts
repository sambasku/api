import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Category } from '../../domain/entities/category.entity';
import type { CategoryRepository } from '../../domain/repositories/category.repository';

export interface CreateCategoryCommand {
  name: string;
  description?: string | null;
  parentId?: string | null;
  actorId: string;
  requestId?: string | null;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: CreateCategoryCommand): Promise<Category> {
    const exists = await this.categoryRepo.existsActiveNameCaseInsensitive(cmd.name);
    if (exists) {
      throw new NotFoundError('CATEGORY_NAME_EXISTS', 'Kategori dengan nama tersebut sudah ada');
    }

    const category = await this.categoryRepo.create({
      name: cmd.name,
      description: cmd.description ?? null,
    });

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'category',
      entityId: category.id,
      newData: { name: category.name },
      requestId: cmd.requestId ?? null,
    });

    return category;
  }
}

export interface UpdateCategoryCommand {
  id: string;
  name?: string;
  description?: string | null;
  parentId?: string | null;
  actorId: string;
  requestId?: string | null;
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: UpdateCategoryCommand): Promise<Category> {
    const category = await this.categoryRepo.update(cmd.id, {
      name: cmd.name,
      description: cmd.description,
      parentId: cmd.parentId,
    });

    if (!category) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori dengan id tersebut tidak ditemukan');
    }

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'category',
      entityId: category.id,
      newData: { name: category.name },
      requestId: cmd.requestId ?? null,
    });

    return category;
  }
}

export class DeleteCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: { id: string; actorId: string; requestId?: string | null }): Promise<void> {
    const ok = await this.categoryRepo.softDelete(cmd.id);
    if (!ok) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori dengan id tersebut tidak ditemukan');
    }

    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'category',
      entityId: cmd.id,
      newData: { deleted: true },
      requestId: cmd.requestId ?? null,
    });
  }
}