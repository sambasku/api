import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { CulinaryCategoryRecord } from '../../domain/entities/culinary-category.entity';
import type {
  CreateCulinaryCategoryInput,
  ListKulinerCategoriesInput,
  ListKulinerCategoriesResult,
  UpdateCulinaryCategoryInput,
  CulinaryCategoryRepository,
} from '../../domain/repositories/culinary-category.repository';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCulinaryCategoryUseCase {
  constructor(private readonly repo: CulinaryCategoryRepository) {}

  async execute(input: CreateCulinaryCategoryInput): Promise<CulinaryCategoryRecord> {
    if (!ID_RE.test(input.id)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Id kategori tidak valid', [
        { field: 'id', message: 'Pakai slug huruf kecil dan hyphen, mis. kuliner' },
      ]);
    }
    const live = await this.repo.findById(input.id);
    if (live) {
      throw new ConflictError('CATEGORY_ID_TAKEN', 'Id kategori sudah dipakai');
    }
    return this.repo.create(input);
  }
}

export class UpdateCulinaryCategoryUseCase {
  constructor(private readonly repo: CulinaryCategoryRepository) {}

  async execute(input: UpdateCulinaryCategoryInput): Promise<CulinaryCategoryRecord> {
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteCulinaryCategoryUseCase {
  constructor(private readonly repo: CulinaryCategoryRepository) {}

  async execute(id: string): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    const used = await this.repo.countCuisinesUsing(id);
    if (used > 0) {
      throw new ConflictError(
        'CATEGORY_IN_USE',
        'Kategori masih dipakai kuliner. Pindahkan atau hapus kuliner terkait dulu.',
      );
    }
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
  }
}

export class ListKulinerCategoriesUseCase {
  constructor(private readonly repo: CulinaryCategoryRepository) {}

  execute(input: ListKulinerCategoriesInput): Promise<ListKulinerCategoriesResult> {
    return this.repo.list(input);
  }
}

export class GetCulinaryCategoryUseCase {
  constructor(private readonly repo: CulinaryCategoryRepository) {}

  async execute(id: string, publicOnly = true): Promise<CulinaryCategoryRecord> {
    const row = await this.repo.findById(id);
    if (!row || (publicOnly && row.status !== 'published')) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return row;
  }
}
