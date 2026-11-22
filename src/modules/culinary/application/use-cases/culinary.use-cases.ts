import {
  BadRequestError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
} from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import {
  slugifyUsaha,
} from '@/modules/usaha/application/use-cases/usaha.use-cases';
import {
  ensureOneMainImage,
  type CuisineDetail,
  type CuisineImage,
  type CulinaryCategoryRef,
} from '../../domain/entities/culinary.entity';
import type {
  CreateCuisineInput,
  CulinaryRepository,
  ListCuisinesInput,
  UpdateCuisineInput,
} from '../../domain/repositories/culinary.repository';

export { slugifyUsaha };

/** #281: galeri kuliner (images_json) - cap lebih kecil dari wisata. */
const PHOTO_CAP = 20;
const PHOTO_DAILY = 5;

/** URL harus hasil unggah SambasKu (`assets/culinary/`). */
export function assertOurCuisineImage(url: string): void {
  if (
    !url.startsWith('https://cdn.jsdelivr.net/') ||
    !url.includes('/assets/culinary/')
  ) {
    throw new BadRequestError('IMAGE_URL', 'Foto harus hasil unggah SambasKu');
  }
}

/** Slug unik untuk kuliner. Satu query IN per kandidat (rule subrequest). */
export class UniqueCulinarySlugUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(name: string): Promise<string> {
    const base = slugifyUsaha(name) || 'kuliner';
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingCuisineSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }
}

/** Pencarian duplikat read-only (PRD 11) - tidak pernah merge otomatis. */
export class FindCulinaryDuplicatesUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  execute(q: string, excludeId?: string) {
    if (!q.trim()) return Promise.resolve([]);
    return this.repo.findCuisineDuplicates({ q, excludeId });
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

export class ListCulinaryCategoriesUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  execute(publicOnly: boolean): Promise<CulinaryCategoryRef[]> {
    return this.repo.listCategories(publicOnly);
  }
}

/** Pembatasan sementara (pola usaha 12.4) - alasan wajib. */
export class RestrictCulinaryUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(id: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestError(
        'REASON_REQUIRED',
        'Alasan pembatasan wajib diisi',
        [{ field: 'reason', message: 'Tulis alasan pembatasan' }],
      );
    }
    const updated = await this.repo.updateCuisine({
      id,
      publishStatus: 'restricted' as const,
      restricted: { reason: reason.trim() },
    });
    if (!updated) {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
    return updated;
  }
}

/** Pulihkan dari archived/restricted ke published (pola usaha). */
export class RestoreCulinaryUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(id: string) {
    const updated = await this.repo.updateCuisine({
      id,
      publishStatus: 'published' as const,
      restricted: null,
    });
    if (!updated) {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteCulinaryUseCase {
  constructor(private readonly repo: CulinaryRepository) {}
  async execute(id: string): Promise<void> {
    const ok = await this.repo.softDeleteCuisine(id);
    if (!ok) {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
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
    ensureOneMainImage(images).map((img) => ({
      url: img.url,
      isMain: img.isMain,
      attribution: img.attribution ?? null,
    })),
  );
}

/**
 * #281: tambah foto ke kuliner published (mirror wisata/usaha).
 * Simpan di `images_json` (bukan tabel terpisah). Wajib login; 1 event
 * `cuisine_photo_added` per batch.
 */
export class AppendCuisineImagesUseCase {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly users: UserRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(slug: string, userId: string, urls: string[]): Promise<void> {
    if (userId === ANONIM_USER_ID) {
      throw new UnauthorizedError(
        'UNAUTHORIZED',
        'Masuk dulu untuk menambah foto kuliner',
      );
    }
    const cuisine = await this.repo.findCuisineBySlug(slug, {
      publicOnly: true,
    });
    if (!cuisine || cuisine.publishStatus !== 'published') {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
    for (const url of urls) assertOurCuisineImage(url);
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }
    if (cuisine.images.length + urls.length > PHOTO_CAP) {
      throw new BadRequestError(
        'PHOTO_CAP',
        `Foto kuliner ini sudah penuh (${PHOTO_CAP})`,
      );
    }
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
    const today = cuisine.images.filter((img) => {
      const attr = img.attribution;
      if (!attr?.authorId || attr.authorId !== userId) return false;
      if (!attr.uploadedAt) return false;
      const t = Date.parse(attr.uploadedAt);
      return Number.isFinite(t) && t >= sinceMs;
    }).length;
    if (today + urls.length > PHOTO_DAILY) {
      throw new RateLimitedError(
        'Maksimal 5 foto per kuliner dalam 24 jam',
      );
    }
    const have = new Set(cuisine.images.map((img) => img.url));
    const fresh = urls.filter((url) => !have.has(url));
    if (fresh.length === 0) return;
    const name = user.displayName || user.username;
    const uploadedAt = new Date().toISOString();
    const next = [
      ...cuisine.images,
      ...fresh.map((url) => ({
        url,
        isMain: false,
        attribution: {
          name,
          provider: 'sambasku',
          license: 'CC BY-SA 4.0',
          authorId: userId,
          uploadedAt,
        },
      })),
    ];
    // Pastikan tetap ada tepat satu isMain (foto baru tidak jadi cover).
    await this.repo.updateCuisine({
      id: cuisine.id,
      imagesJson: imagesToJson(next),
    });
    await this.activityEvents?.safe({
      kind: 'cuisine_photo_added',
      actorId: userId,
      targetId: cuisine.id,
      dedupeKey: `cuisine_photo:${cuisine.id}:${fresh.join('|')}`,
      payload: `Menambahkan foto kuliner ${cuisine.name}`,
    });
  }
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

export type { CreateCuisineInput, UpdateCuisineInput, CuisineDetail };
