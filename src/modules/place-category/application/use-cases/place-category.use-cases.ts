import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { PlaceCategoryRecord } from '../../domain/entities/place-category.entity';
import type {
  CreatePlaceCategoryInput,
  ListPlaceCategoriesInput,
  ListPlaceCategoriesResult,
  PlaceCategoryRepository,
  UpdatePlaceCategoryInput,
} from '../../domain/repositories/place-category.repository';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePlaceCategoryUseCase {
  constructor(private readonly repo: PlaceCategoryRepository) {}

  async execute(input: CreatePlaceCategoryInput): Promise<PlaceCategoryRecord> {
    if (!ID_RE.test(input.id)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Id kategori tidak valid', [
        { field: 'id', message: 'Pakai slug huruf kecil dan hyphen, mis. religi' },
      ]);
    }
    const live = await this.repo.findById(input.id);
    if (live) {
      throw new ConflictError('CATEGORY_ID_TAKEN', 'Id kategori sudah dipakai');
    }
    return this.repo.create(input);
  }
}

export class UpdatePlaceCategoryUseCase {
  constructor(private readonly repo: PlaceCategoryRepository) {}

  async execute(input: UpdatePlaceCategoryInput): Promise<PlaceCategoryRecord> {
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return updated;
  }
}

export class DeletePlaceCategoryUseCase {
  constructor(private readonly repo: PlaceCategoryRepository) {}

  async execute(id: string): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    const used = await this.repo.countPlacesUsing(id);
    if (used > 0) {
      throw new ConflictError(
        'CATEGORY_IN_USE',
        'Kategori masih dipakai wisata. Pindahkan atau hapus wisata terkait dulu.',
      );
    }
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
  }
}

export class ListPlaceCategoriesUseCase {
  constructor(private readonly repo: PlaceCategoryRepository) {}

  execute(input: ListPlaceCategoriesInput): Promise<ListPlaceCategoriesResult> {
    return this.repo.list(input);
  }
}

export class GetPlaceCategoryUseCase {
  constructor(private readonly repo: PlaceCategoryRepository) {}

  async execute(id: string, publicOnly = true): Promise<PlaceCategoryRecord> {
    const row = await this.repo.findById(id);
    if (!row || (publicOnly && row.status !== 'published')) {
      throw new NotFoundError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    return row;
  }
}
