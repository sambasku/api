import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { UsahaCategoryRecord } from '../../domain/entities/usaha-category.entity';
import type {
  CreateUsahaCategoryInput,
  ListUsahaCategoriesInput,
  ListUsahaCategoriesResult,
  UpdateUsahaCategoryInput,
  UsahaCategoryRepository,
} from '../../domain/repositories/usaha-category.repository';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateUsahaCategoryUseCase {
  constructor(private readonly repo: UsahaCategoryRepository) {}

  async execute(input: CreateUsahaCategoryInput): Promise<UsahaCategoryRecord> {
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

export class UpdateUsahaCategoryUseCase {
  constructor(private readonly repo: UsahaCategoryRepository) {}

  async execute(input: UpdateUsahaCategoryInput): Promise<UsahaCategoryRecord> {
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteUsahaCategoryUseCase {
  constructor(private readonly repo: UsahaCategoryRepository) {}

  async execute(id: string): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    const used = await this.repo.countUsahaUsing(id);
    if (used > 0) {
      throw new ConflictError(
        'CATEGORY_IN_USE',
        'Kategori masih dipakai usaha. Pindahkan atau hapus usaha terkait dulu.',
      );
    }
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
  }
}

export class ListUsahaCategoriesUseCase {
  constructor(private readonly repo: UsahaCategoryRepository) {}

  execute(input: ListUsahaCategoriesInput): Promise<ListUsahaCategoriesResult> {
    return this.repo.list(input);
  }
}

export class GetUsahaCategoryUseCase {
  constructor(private readonly repo: UsahaCategoryRepository) {}

  async execute(id: string, publicOnly = true): Promise<UsahaCategoryRecord> {
    const row = await this.repo.findById(id);
    if (!row || (publicOnly && row.status !== 'published')) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return row;
  }
}
