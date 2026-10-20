import { BadRequestError, ConflictError, NotFoundError, RateLimitedError } from '@/shared/errors/app-error';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { PlaceCategoryRepository } from '@/modules/place-category/domain/repositories/place-category.repository';
import type { Place, PlaceRelatedCard } from '../../domain/entities/place.entity';
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

  async execute(slug: string, publicOnly = true): Promise<Place & { imageCount: number; relatedCards: PlaceRelatedCard[] }> {
    const place = await this.repo.findBySlug(slug, { publicOnly });
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
    const page = await this.repo.listImages(place.id, 0, 12);
    const relatedCards = await this.repo.resolveRelated(place.related);
    return { ...place, images: page.items, imageCount: page.total, relatedCards };
  }
}

const GALLERY_PAGE = 12;
const PHOTO_CAP = 100;
const PHOTO_DAILY = 5;

export function assertOurPlaceImage(url: string): void {
  if (!url.startsWith('https://cdn.jsdelivr.net/') || !url.includes('/assets/places/')) {
    throw new BadRequestError('IMAGE_URL', 'Foto harus hasil unggah SambasKu');
  }
}

export class ListPlaceImagesUseCase {
  constructor(private readonly repo: PlaceRepository) {}

  async execute(slug: string, offset: number) {
    const place = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!place) throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    const page = await this.repo.listImages(place.id, offset, GALLERY_PAGE);
    const next = offset + page.items.length < page.total ? offset + page.items.length : null;
    return { items: page.items, total: page.total, nextOffset: next };
  }
}

export class AppendPlaceImagesUseCase {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(slug: string, userId: string, urls: string[]): Promise<void> {
    const place = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!place || place.status !== 'published') {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
    for (const url of urls) assertOurPlaceImage(url);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    const total = (await this.repo.listImages(place.id, 0, 1)).total;
    if (total + urls.length > PHOTO_CAP) {
      throw new BadRequestError('PHOTO_CAP', 'Foto tempat ini sudah penuh (100)');
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = await this.repo.countUploadsSince(place.id, userId, since);
    if (today + urls.length > PHOTO_DAILY) {
      throw new RateLimitedError('Maksimal 5 foto per tempat dalam 24 jam');
    }
    const have = new Set(place.images.map((img) => img.url));
    const fresh = urls.filter((url) => !have.has(url));
    const name = user.displayName || user.username;
    await this.repo.appendImages(
      place.id,
      fresh.map((url) => ({
        url,
        isMain: false,
        attribution: { name, provider: 'sambasku', authorId: userId },
      })),
    );
  }
}
