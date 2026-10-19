import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { Place } from '../../domain/entities/place.entity';
import type {
  CreatePlaceInput,
  ListPlacesInput,
  ListPlacesResult,
  PlaceRepository,
  UpdatePlaceInput,
} from '../../domain/repositories/place.repository';

export class CreatePlaceUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  async execute(input: CreatePlaceInput): Promise<Place> {
    const existing = await this.repo.findBySlugAny(input.slug);
    if (existing) {
      throw new ConflictError('SLUG_TAKEN', 'Slug place sudah dipakai');
    }
    return this.repo.create(input);
  }
}

export class UpdatePlaceUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  async execute(input: UpdatePlaceInput): Promise<Place> {
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
