import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import {
  assertOurPlaceImage,
  CreatePlaceUseCase,
  UpdatePlaceUseCase,
} from '@/modules/place/application/use-cases/place.use-cases';
import type { PlaceRepository } from '@/modules/place/domain/repositories/place.repository';
import type { PlaceCategoryRepository } from '@/modules/place-category/domain/repositories/place-category.repository';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type {
  ContributionPayload,
  PlaceContribution,
  PlaceContributionRepositoryImpl,
} from '../infrastructure/place-contribution.repository.impl';

const PENDING_CAP = 10;

export class PlaceContributionUseCases {
  constructor(
    private readonly contrib: PlaceContributionRepositoryImpl,
    private readonly places: PlaceRepository,
    private readonly categories: PlaceCategoryRepository,
    private readonly regions: RegionRepository,
    private readonly users: UserRepository,
    private readonly createPlace: CreatePlaceUseCase,
    private readonly updatePlace: UpdatePlaceUseCase,
  ) {}

  async submit(userId: string, placeId: string | null, payload: ContributionPayload): Promise<PlaceContribution> {
    await this.assertPayload(payload);
    if ((await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError('PENDING_CAP', 'Maksimal 10 usulan yang masih menunggu');
    }
    let base: Date | null = null;
    const place = placeId ? await this.loadPlace(placeId) : null;
    if (placeId) {
      if (!place || place.status === 'archived') {
        throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
      }
      if (await this.contrib.findPendingEdit(userId, place.id)) {
        throw new ConflictError('PENDING_EXISTS', 'Kamu sudah punya usulan suntingan untuk tempat ini');
      }
      base = place.updatedAt;
    }
    return this.contrib.create({
      userId,
      placeId: place?.id ?? null,
      baseUpdatedAt: base,
      payload,
    });
  }

  async mine(userId: string): Promise<PlaceContribution[]> {
    return this.contrib.listByUser(userId);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') throw new ConflictError('NOT_PENDING', 'Usulan sudah ditinjau');
    await this.contrib.remove(id);
  }

  async listPending(): Promise<PlaceContribution[]> {
    return this.contrib.listByStatus('pending');
  }

  async approve(id: string): Promise<void> {
    const row = await this.mustPending(id);
    const user = await this.users.findById(row.userId);
    const credit = user?.displayName || user?.username || 'Pengguna';
    const images = row.payload.images.map((img, i) => ({
      url: img.url,
      isMain: i === 0 && row.placeId == null,
      attribution: { name: credit, provider: 'sambasku', authorId: row.userId },
    }));
    if (!row.placeId) {
      await this.createPlace.execute({
        slug: row.payload.slug,
        name: row.payload.name,
        category: row.payload.category,
        type: row.payload.type,
        lat: row.payload.lat,
        lng: row.payload.lng,
        mapsUrl: row.payload.mapsUrl,
        shortDescription: row.payload.shortDescription,
        regionId: row.payload.regionId,
        villageId: row.payload.villageId,
        hours: row.payload.hours,
        contact: row.payload.contact,
        authorId: row.userId,
        images,
        status: 'published',
      });
      await this.contrib.setStatus(id, 'approved');
      return;
    }
    const place = await this.places.findById(row.placeId);
    if (!place || place.status === 'archived') {
      throw new ConflictError('STALE_PROPOSAL', 'Tempat sudah tidak ada');
    }
    const base = row.baseUpdatedAt?.getTime() ?? null;
    const current = place.updatedAt?.getTime() ?? null;
    if (base !== current) throw new ConflictError('STALE_PROPOSAL', 'Tempat berubah sejak usulan dikirim');
    await this.updatePlace.execute({
      id: place.id,
      slug: row.payload.slug,
      name: row.payload.name,
      category: row.payload.category,
      type: row.payload.type,
      lat: row.payload.lat,
      lng: row.payload.lng,
      mapsUrl: row.payload.mapsUrl,
      shortDescription: row.payload.shortDescription,
      regionId: row.payload.regionId,
      villageId: row.payload.villageId,
      hours: row.payload.hours,
      contact: row.payload.contact,
    });
    const have = new Set(place.images.map((img) => img.url));
    const fresh = images.filter((img) => !have.has(img.url)).map((img) => ({ ...img, isMain: false }));
    await this.places.appendImages(place.id, fresh);
    await this.contrib.setStatus(id, 'approved');
  }

  async reject(id: string): Promise<void> {
    await this.mustPending(id);
    await this.contrib.setStatus(id, 'rejected');
  }

  private async mustPending(id: string): Promise<PlaceContribution> {
    const row = await this.contrib.findById(id);
    if (!row) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') throw new ConflictError('NOT_PENDING', 'Usulan sudah ditinjau');
    return row;
  }

  private async loadPlace(idOrSlug: string) {
    return (await this.places.findById(idOrSlug)) ?? (await this.places.findBySlugAny(idOrSlug));
  }

  private async assertPayload(payload: ContributionPayload): Promise<void> {
    const hasLat = payload.lat != null;
    const hasLng = payload.lng != null;
    if (hasLat !== hasLng) {
      throw new BadRequestError('LATLNG_PAIR', 'Latitude dan longitude harus diisi berpasangan');
    }
    const category = await this.categories.findById(payload.category);
    if (!category || category.status !== 'published') {
      throw new BadRequestError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    if (payload.regionId) {
      const region = await this.regions.findById(payload.regionId);
      if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
        throw new BadRequestError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
      }
    }
    if (payload.villageId) {
      const village = await this.regions.findById(payload.villageId);
      if (!village || village.type !== 'desa' || village.status !== 'published') {
        throw new BadRequestError('VILLAGE_NOT_FOUND', 'Desa tidak ditemukan');
      }
      if (payload.regionId && village.parentId !== payload.regionId) {
        throw new BadRequestError('VILLAGE_MISMATCH', 'Desa bukan bagian dari kecamatan yang dipilih');
      }
    }
    if (payload.images.length > 20) {
      throw new BadRequestError('IMAGE_CAP', 'Maksimal 20 foto per usulan');
    }
    for (const img of payload.images) assertOurPlaceImage(img.url);
  }
}
