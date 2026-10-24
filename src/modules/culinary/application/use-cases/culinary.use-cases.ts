import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import {
  slugifyUsaha,
} from '@/modules/usaha/application/use-cases/usaha.use-cases';
import type {
  CuisineDetail,
  CuisineImage,
  CuisinePlaceLink,
  CulinaryCategoryRef,
  CulinaryPlaceDetail,
} from '../../domain/entities/culinary.entity';
import type {
  CreateCuisineInput,
  CreatePlaceInput,
  CulinaryRepository,
  ListCuisinesInput,
  ListPlacesInput,
  UpdateCuisineInput,
  UpdatePlaceInput,
} from '../../domain/repositories/culinary.repository';

export { slugifyUsaha };

/** Slug unik untuk kuliner/tempat. Satu query IN per kandidat (rule subrequest). */
export class UniqueCulinarySlugUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly kind: 'cuisine' | 'place',
  ) {}
  async execute(name: string): Promise<string> {
    const base =
      slugifyUsaha(name) || (this.kind === 'cuisine' ? 'kuliner' : 'tempat');
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken =
      this.kind === 'cuisine'
        ? await this.repo.existingCuisineSlugs(candidates)
        : await this.repo.existingPlaceSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }
}

/** Pencarian duplikat read-only (PRD 11) - tidak pernah merge otomatis. */
export class FindCulinaryDuplicatesUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly kind: 'cuisine' | 'place',
  ) {}
  execute(q: string, excludeId?: string) {
    if (!q.trim()) return Promise.resolve([]);
    return this.kind === 'cuisine'
      ? this.repo.findCuisineDuplicates({ q, excludeId })
      : this.repo.findPlaceDuplicates({ q, excludeId });
  }
}

export class ListCuisinesUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  execute(input: ListCuisinesInput) {
    return this.repo.listCuisines(input);
  }
}

export class GetCuisineBySlugUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(slug: string, publicOnly = true): Promise<CuisineDetail> {
    const cuisine = await this.repo.findCuisineBySlug(slug, { publicOnly });
    if (!cuisine) {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
    return cuisine;
  }
}

export class ListCulinaryPlacesUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  execute(input: ListPlacesInput) {
    return this.repo.listPlaces(input);
  }
}

export class GetCulinaryPlaceBySlugUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(slug: string, publicOnly = true): Promise<CulinaryPlaceDetail> {
    const place = await this.repo.findPlaceBySlug(slug, { publicOnly });
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
    }
    return place;
  }
}

export class ListCulinaryCategoriesUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  execute(publicOnly: boolean): Promise<CulinaryCategoryRef[]> {
    return this.repo.listCategories(publicOnly);
  }
}

/** Pembatasan sementara (pola usaha 12.4) - alasan wajib. */
export class RestrictCulinaryUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly kind: 'cuisine' | 'place',
  ) {}
  async execute(id: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestError(
        'REASON_REQUIRED',
        'Alasan pembatasan wajib diisi',
        [{ field: 'reason', message: 'Tulis alasan pembatasan' }],
      );
    }
    const patch = {
      publishStatus: 'restricted' as const,
      restricted: { reason: reason.trim() },
    };
    const updated =
      this.kind === 'cuisine'
        ? await this.repo.updateCuisine({ id, ...patch })
        : await this.repo.updatePlace({ id, ...patch });
    if (!updated) {
      throw new NotFoundError(
        this.kind === 'cuisine' ? 'CUISINE_NOT_FOUND' : 'PLACE_NOT_FOUND',
        this.kind === 'cuisine' ? 'Kuliner tidak ditemukan' : 'Tempat tidak ditemukan',
      );
    }
    return updated;
  }
}

/** Pulihkan dari archived/restricted ke published (pola usaha). */
export class RestoreCulinaryUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly kind: 'cuisine' | 'place',
  ) {}
  async execute(id: string) {
    const patch = { publishStatus: 'published' as const, restricted: null };
    const updated =
      this.kind === 'cuisine'
        ? await this.repo.updateCuisine({ id, ...patch })
        : await this.repo.updatePlace({ id, ...patch });
    if (!updated) {
      throw new NotFoundError(
        this.kind === 'cuisine' ? 'CUISINE_NOT_FOUND' : 'PLACE_NOT_FOUND',
        this.kind === 'cuisine' ? 'Kuliner tidak ditemukan' : 'Tempat tidak ditemukan',
      );
    }
    return updated;
  }
}

export class DeleteCulinaryUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly kind: 'cuisine' | 'place',
  ) {}
  async execute(id: string): Promise<void> {
    const ok =
      this.kind === 'cuisine'
        ? await this.repo.softDeleteCuisine(id)
        : await this.repo.softDeletePlace(id);
    if (!ok) {
      throw new NotFoundError(
        this.kind === 'cuisine' ? 'CUISINE_NOT_FOUND' : 'PLACE_NOT_FOUND',
        this.kind === 'cuisine' ? 'Kuliner tidak ditemukan' : 'Tempat tidak ditemukan',
      );
    }
  }
}

/** Guard pengelola tempat (dipakai culinary-contribution & claim). */
export class AssertPlaceManagerUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(placeId: string, userId: string): Promise<CulinaryPlaceDetail> {
    const place = await this.repo.findPlaceById(placeId);
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
    }
    if (place.managerId !== userId) {
      throw new ConflictError(
        'NOT_MANAGER',
        'Hanya pengelola terverifikasi yang bisa melakukan aksi ini',
      );
    }
    return place;
  }
}

/** Serializer payload JSON gambar/sumber dari form usulan. */
export function imagesToJson(
  images: Array<{
    url: string;
    isMain?: boolean;
    attribution?: CuisineImage['attribution'];
  }> | undefined,
): string | null {
  if (!images?.length) return null;
  return JSON.stringify(
    images.map((img) => ({
      url: img.url,
      isMain: img.isMain === true,
      attribution: img.attribution ?? null,
    })),
  );
}

export function sourcesToJson(
  sources:
    | Array<{
        name: string;
        type?: string;
        address: string;
        license?: string | null;
        license_url?: string | null;
      }>
    | undefined,
): string | null {
  if (!sources?.length) return null;
  return JSON.stringify(sources);
}

export type { CreateCuisineInput, CreatePlaceInput, UpdateCuisineInput, UpdatePlaceInput, CuisinePlaceLink, CuisineDetail, CulinaryPlaceDetail };
