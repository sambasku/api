import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
} from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { Region } from '@/modules/region/domain/entities/region.entity';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  UsahaCategoryRef,
  UsahaDetail,
  UsahaImage,
  UsahaListItem,
} from '../../domain/entities/usaha.entity';
import type {
  CreateUsahaInput,
  ListUsahasInput,
  ListUsahasResult,
  UpdateUsahaInput,
  UsahaRepository,
} from '../../domain/repositories/usaha.repository';

const GALLERY_PAGE = 12;
const PHOTO_CAP = 100;
const PHOTO_DAILY = 5;

export function assertOurUsahaImage(url: string): void {
  if (
    !url.startsWith('https://cdn.jsdelivr.net/') ||
    !url.includes('/assets/usahas/')
  ) {
    throw new BadRequestError('IMAGE_URL', 'Foto harus hasil unggah SambasKu');
  }
}

async function assertCategory(
  repo: UsahaRepository,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const ref = await repo.categoryRef(categoryId);
  if (!ref) {
    throw new BadRequestError(
      'CATEGORY_NOT_FOUND',
      'Kategori usaha tidak ditemukan',
      [{ field: 'category_id', message: 'Pilih kategori yang valid' }],
    );
  }
}

/** Resolve slug/ULID → Region kecamatan published; throw jika tidak valid. */
async function resolveKecamatan(
  regions: RegionRepository,
  regionId: string | null | undefined,
): Promise<Region> {
  if (!regionId) {
    throw new BadRequestError(
      'REGION_REQUIRED',
      'Wilayah (kecamatan) wajib diisi',
      [{ field: 'region_id', message: 'Pilih kecamatan dulu ya' }],
    );
  }
  const region = await regions.findByIdOrSlug(regionId);
  if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
    throw new BadRequestError(
      'REGION_NOT_FOUND',
      'Kecamatan tidak ditemukan',
      [{ field: 'region_id', message: 'Pilih kecamatan yang valid' }],
    );
  }
  return region;
}

/** Resolve slug/ULID → Region desa published; cek induk bila regionId (ULID) ada. */
async function resolveDesa(
  regions: RegionRepository,
  villageId: string | null | undefined,
  regionId?: string | null,
): Promise<Region | null> {
  if (!villageId) return null;
  const village = await regions.findByIdOrSlug(villageId);
  if (!village || village.type !== 'desa' || village.status !== 'published') {
    throw new BadRequestError(
      'VILLAGE_NOT_FOUND',
      'Desa tidak ditemukan',
      [{ field: 'village_id', message: 'Pilih desa yang valid' }],
    );
  }
  if (regionId && village.parentId !== regionId) {
    throw new BadRequestError(
      'VILLAGE_MISMATCH',
      'Desa bukan bagian dari kecamatan yang dipilih',
    );
  }
  return village;
}

function assertLatLng(lat?: number | null, lng?: number | null): void {
  if ((lat == null) !== (lng == null)) {
    throw new BadRequestError(
      'LATLNG_PAIR',
      'Latitude dan longitude harus diisi berpasangan',
    );
  }
}

export class CreateUsahaUseCase {
  constructor(
    private readonly repo: UsahaRepository,
    private readonly regions: RegionRepository,
  ) {}

  async execute(input: CreateUsahaInput): Promise<UsahaListItem> {
    await assertCategory(this.repo, input.categoryId);
    const kec = await resolveKecamatan(this.regions, input.regionId);
    const desa = await resolveDesa(this.regions, input.villageId, kec.id);
    assertLatLng(input.lat, input.lng);
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
    }
    return this.repo.create({
      ...input,
      regionId: kec.id,
      villageId: desa?.id ?? input.villageId ?? null,
    });
  }
}

export class UpdateUsahaUseCase {
  constructor(
    private readonly repo: UsahaRepository,
    private readonly regions: RegionRepository,
  ) {}

  async execute(input: UpdateUsahaInput): Promise<UsahaListItem> {
    const existing = await this.repo.findById(input.id);
    if (!existing) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    if (input.categoryId !== undefined) {
      await assertCategory(this.repo, input.categoryId);
    }
    let regionId = input.regionId;
    let villageId = input.villageId;
    if (input.regionId !== undefined) {
      // Update boleh mengosongkan region? Tidak - wilayah tetap wajib.
      const kec = await resolveKecamatan(this.regions, input.regionId);
      regionId = kec.id;
    }
    if (input.villageId !== undefined) {
      const desa = await resolveDesa(
        this.regions,
        input.villageId,
        regionId ?? existing.regionId,
      );
      villageId = desa?.id ?? null;
    }
    assertLatLng(input.lat ?? existing.lat, input.lng ?? existing.lng);
    if (input.slug && input.slug !== existing.slug) {
      const other = await this.repo.findBySlug(input.slug);
      if (other) {
        throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
      }
    }
    const updated = await this.repo.update({
      ...input,
      ...(regionId !== undefined ? { regionId } : {}),
      ...(villageId !== undefined ? { villageId } : {}),
    });
    if (!updated) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteUsahaUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(id: string): Promise<void> {
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
  }
}

export class ListUsahasUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  execute(input: ListUsahasInput): Promise<ListUsahasResult> {
    return this.repo.list(input);
  }
}

export class GetUsahaBySlugUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(slug: string, publicOnly = true): Promise<UsahaDetail> {
    const usaha = await this.repo.findBySlug(slug, { publicOnly });
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    const page = await this.repo.listImages(usaha.id, 0, GALLERY_PAGE);
    return { ...usaha, images: page.items };
  }
}

export class ListUsahaImagesUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(
    slug: string,
    offset: number,
  ): Promise<{ items: UsahaImage[]; total: number; nextOffset: number | null }> {
    const usaha = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    const page = await this.repo.listImages(usaha.id, offset, GALLERY_PAGE);
    const next =
      offset + page.items.length < page.total
        ? offset + page.items.length
        : null;
    return { items: page.items, total: page.total, nextOffset: next };
  }
}

export class AppendUsahaImagesUseCase {
  constructor(
    private readonly repo: UsahaRepository,
    private readonly users: UserRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(slug: string, userId: string, urls: string[]): Promise<void> {
    if (userId === ANONIM_USER_ID) {
      throw new UnauthorizedError(
        'UNAUTHORIZED',
        'Masuk dulu untuk menambah foto usaha',
      );
    }
    const usaha = await this.repo.findBySlug(slug, { publicOnly: true });
    if (!usaha || usaha.publishStatus !== 'published') {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    for (const url of urls) assertOurUsahaImage(url);
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'User tidak ditemukan');
    }
    const total = (await this.repo.listImages(usaha.id, 0, 1)).total;
    if (total + urls.length > PHOTO_CAP) {
      throw new BadRequestError('PHOTO_CAP', 'Foto usaha ini sudah penuh (100)');
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = await this.repo.countUploadsSince(usaha.id, userId, since);
    if (today + urls.length > PHOTO_DAILY) {
      throw new RateLimitedError('Maksimal 5 foto per usaha dalam 24 jam');
    }
    const existing = await this.repo.listImages(usaha.id, 0, PHOTO_CAP);
    const have = new Set(existing.items.map((img) => img.url));
    const fresh = urls.filter((url) => !have.has(url));
    if (fresh.length === 0) return;
    const name = user.displayName || user.username;
    await this.repo.appendImages(
      usaha.id,
      fresh.map((url) => ({
        url,
        isMain: false,
        attribution: {
          name,
          provider: 'sambasku',
          authorId: userId,
          username: user.username,
        },
      })),
    );
    await this.activityEvents?.safe({
      kind: 'usaha_photo_added',
      actorId: userId,
      targetId: usaha.id,
      dedupeKey: `usaha_photo:${usaha.id}:${fresh.join('|')}`,
      payload: `Menambahkan foto usaha ${usaha.name}`,
    });
  }
}

export class HideUsahaImageUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(usahaId: string, imageId: string): Promise<void> {
    const hidden = await this.repo.hideImage(usahaId, imageId);
    if (!hidden) {
      throw new NotFoundError('IMAGE_NOT_FOUND', 'Foto tidak ditemukan');
    }
  }
}

/** Pembatasan sementara (PRD 12.4) - alasan wajib. */
export class RestrictUsahaUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(id: string, reason: string): Promise<UsahaListItem> {
    if (!reason.trim()) {
      throw new BadRequestError(
        'REASON_REQUIRED',
        'Alasan pembatasan wajib diisi',
        [{ field: 'reason', message: 'Tulis alasan pembatasan' }],
      );
    }
    const updated = await this.repo.update({
      id,
      publishStatus: 'restricted',
      restricted: { reason: reason.trim() },
    });
    if (!updated) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return updated;
  }
}

/** Pulihkan dari archived/restricted ke published (PRD 12.3, inisiatif admin). */
export class RestoreUsahaUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(id: string): Promise<UsahaListItem> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    const updated = await this.repo.update({
      id,
      publishStatus: 'published',
      restricted: null,
    });
    if (!updated) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return updated;
  }
}

export class ListUsahaCategoriesUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  execute(publicOnly: boolean): Promise<UsahaCategoryRef[]> {
    return this.repo.listCategories(publicOnly);
  }
}

/** Saran duplikat read-only (PRD 14) - tidak pernah merge otomatis. */
export class FindUsahaDuplicatesUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(id: string) {
    const usaha = await this.repo.findById(id);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return this.repo.findDuplicates({
      usahaId: usaha.id,
      name: usaha.name,
      phone: usaha.phone,
    });
  }
}

/** Guard pengelola: dipakai usaha-contribution/usaha-claim (PRD 4.3). */
export class AssertManagerUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(usahaId: string, userId: string): Promise<UsahaDetail> {
    const usaha = await this.repo.findById(usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    if (usaha.managerId !== userId) {
      throw new ForbiddenError(
        'NOT_MANAGER',
        'Hanya pengelola terverifikasi yang bisa melakukan aksi ini',
      );
    }
    return usaha;
  }
}

/** Slug dari teks bebas (huruf kecil, hyphen). */
export function slugifyUsaha(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'usaha'
  );
}

/**
 * Slug unik dari nama usaha. Semua kandidat dicek dalam SATU query IN
 * (bukan loop query per kandidat - rule subrequest).
 */
export class UniqueUsahaSlugUseCase {
  constructor(private readonly repo: UsahaRepository) {}

  async execute(name: string): Promise<string> {
    const base = slugifyUsaha(name);
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }
}

