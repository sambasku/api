import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { LayananCategoryRecord, LayananCategoryStatus } from '../../domain/entities/layanan-category.entity';
import type {
  CreateLayananCategoryInput,
  LayananCategoryRepository,
  UpdateLayananCategoryInput,
} from '../../domain/repositories/layanan-category.repository';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateLayananCategoryUseCase {
  constructor(private readonly repo: LayananCategoryRepository) {}

  async execute(input: CreateLayananCategoryInput): Promise<LayananCategoryRecord> {
    if (!ID_RE.test(input.id)) {
      throw new ValidationError([{ field: 'id', message: 'Pakai slug huruf kecil dan hyphen, mis. pmi' }]);
    }
    if (await this.repo.findById(input.id)) {
      throw new ConflictError('CATEGORY_ID_TAKEN', 'Id kategori sudah dipakai');
    }
    return this.repo.create(input);
  }
}

export class UpdateLayananCategoryUseCase {
  constructor(private readonly repo: LayananCategoryRepository) {}

  async execute(input: UpdateLayananCategoryInput): Promise<LayananCategoryRecord> {
    const updated = await this.repo.update(input);
    if (!updated) throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    return updated;
  }
}

export class DeleteLayananCategoryUseCase {
  constructor(private readonly repo: LayananCategoryRepository) {}

  async execute(id: string): Promise<void> {
    if (!(await this.repo.findById(id))) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    if ((await this.repo.countLayananUsing(id)) > 0) {
      throw new ConflictError(
        'CATEGORY_IN_USE',
        'Kategori masih dipakai layanan. Arsipkan kategori ini, jangan dihapus.',
      );
    }
    if (!(await this.repo.softDelete(id))) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
  }
}

export class ListLayananCategoriesUseCase {
  constructor(private readonly repo: LayananCategoryRepository) {}

  execute(input: { publicOnly: boolean; status?: LayananCategoryStatus }) {
    return this.repo.list(input);
  }
}

/**
 * Dipakai saat layanan baru / kategori yang diganti. Kategori arsip ditolak untuk input baru.
 * Layanan yang sudah ada dengan kategori arsip tetap bisa diedit tanpa mengganti kategori.
 */
export class AssertSelectableLayananCategoryUseCase {
  constructor(private readonly repo: LayananCategoryRepository) {}

  async execute(categoryId: string): Promise<void> {
    const row = await this.repo.findById(categoryId);
    if (!row) {
      throw new ValidationError([{ field: 'category', message: 'Kategori layanan tidak dikenal' }]);
    }
    if (row.status !== 'published') {
      throw new ValidationError([
        {
          field: 'category',
          message: 'Kategori ini sudah diarsipkan. Pilih kategori lain.',
        },
      ]);
    }
  }
}
