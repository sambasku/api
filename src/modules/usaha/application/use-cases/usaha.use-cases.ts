import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import type {
  UsahaCategoryRef,
  UsahaDetail,
  UsahaListItem,
} from '../../domain/entities/usaha.entity';
import type {
  CreateUsahaInput,
  ListUsahasInput,
  ListUsahasResult,
  UpdateUsahaInput,
  UsahaRepository,
} from '../../domain/repositories/usaha.repository';

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

async function assertRegion(
  regions: RegionRepository,
  regionId: string | null | undefined,
): Promise<void> {
  if (!regionId) {
    throw new BadRequestError(
      'REGION_REQUIRED',
      'Wilayah (kecamatan) wajib diisi',
      [{ field: 'region_id', message: 'Pilih kecamatan dulu ya' }],
    );
  }
  const region = await regions.findById(regionId);
  if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
    throw new BadRequestError(
      'REGION_NOT_FOUND',
      'Kecamatan tidak ditemukan',
      [{ field: 'region_id', message: 'Pilih kecamatan yang valid' }],
    );
  }
}

async function assertVillage(
  regions: RegionRepository,
  villageId: string | null | undefined,
  regionId?: string | null,
): Promise<void> {
  if (!villageId) return;
  const village = await regions.findById(villageId);
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
    await assertRegion(this.regions, input.regionId);
    await assertVillage(this.regions, input.villageId, input.regionId);
    assertLatLng(input.lat, input.lng);
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
    }
    return this.repo.create(input);
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
    if (input.regionId !== undefined) {
      // Update boleh mengosongkan region? Tidak - wilayah tetap wajib.
      await assertRegion(this.regions, input.regionId);
    }
    if (input.villageId !== undefined) {
      await assertVillage(
        this.regions,
        input.villageId,
        input.regionId ?? existing.regionId,
      );
    }
    assertLatLng(input.lat ?? existing.lat, input.lng ?? existing.lng);
    if (input.slug && input.slug !== existing.slug) {
      const other = await this.repo.findBySlug(input.slug);
      if (other) {
        throw new ConflictError('SLUG_TAKEN', 'Slug usaha sudah dipakai');
      }
    }
    const updated = await this.repo.update(input);
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
    return usaha;
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
