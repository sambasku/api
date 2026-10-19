import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { PlaceCategoryRepository } from '@/modules/place-category/domain/repositories/place-category.repository';
import type { Place } from '../../domain/entities/place.entity';
import type {
  CreatePlaceInput,
  ListPlacesInput,
  ListPlacesResult,
  PlaceRepository,
  UpdatePlaceInput,
} from '../../domain/repositories/place.repository';

async function assertCategory(
  categories: PlaceCategoryRepository,
  id: string,
): Promise<void> {
  const row = await categories.findById(id);
  if (!row || row.status !== 'published') {
    throw new BadRequestError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan', [
      { field: 'category', message: 'Pilih kategori yang masih published' },
    ]);
  }
}

export class CreatePlaceUseCase {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly categories: PlaceCategoryRepository,
  ) {}

  async execute(input: CreatePlaceInput): Promise<Place> {
    await assertCategory(this.categories, input.category);
    const existing = await this.repo.findBySlugAny(input.slug);
    if (existing) {
      throw new ConflictError('SLUG_TAKEN', 'Slug place sudah dipakai');
    }
    return this.repo.create(input);
  }
}

export class UpdatePlaceUseCase {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly categories: PlaceCategoryRepository,
  ) {}

  async execute(input: UpdatePlaceInput): Promise<Place> {
    if (input.category) {
      await assertCategory(this.categories, input.category);
    }
    if (input.slug) {
      const other = await this.repo.findBySlugAny(input.slug);
      if (other && other.id !== input.id) {
        throw new ConflictError('SLUG_TAKEN', 'Slug place sudah dipakai');
      }
    }
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
    return updated;
  }
}

export class DeletePlaceUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  async execute(id: string): Promise<void> {
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
  }
}

export class ListPlacesUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  execute(input: ListPlacesInput): Promise<ListPlacesResult> {
    return this.repo.list(input);
  }
}

export class GetPlaceBySlugUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  async execute(slug: string, publicOnly = true): Promise<Place> {
    const place = await this.repo.findBySlug(slug, { publicOnly });
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
    return place;
  }
}
