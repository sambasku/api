import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { Region } from '../../domain/entities/region.entity';
import type {
  CreateRegionInput,
  ListRegionsInput,
  ListRegionsResult,
  RegionRepository,
  UpdateRegionInput,
} from '../../domain/repositories/region.repository';

const KEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DESA_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertShape(input: { id: string; type: string; parentId?: string | null }) {
  if (input.type === 'kecamatan') {
    if (input.parentId) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Kecamatan tidak boleh punya induk',
        [{ field: 'parent_id', message: 'Kosongkan induk untuk kecamatan' }],
      );
    }
    if (!KEC_ID.test(input.id)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Id kecamatan tidak valid', [
        { field: 'id', message: 'Pakai slug huruf kecil dan hyphen, mis. teluk-keramat' },
      ]);
    }
    return;
  }
  if (input.type === 'desa') {
    if (!input.parentId) {
      throw new BadRequestError('VALIDATION_ERROR', 'Desa wajib punya kecamatan induk', [
        { field: 'parent_id', message: 'Pilih kecamatan induk' },
      ]);
    }
    if (!DESA_ID.test(input.id)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Id desa tidak valid', [
        {
          field: 'id',
          message: 'Format: <slug-kecamatan>/<slug-desa>, mis. pemangkat/perapakan',
        },
      ]);
    }
    if (!input.id.startsWith(`${input.parentId}/`)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Id desa harus diawali id kecamatan', [
        {
          field: 'id',
          message: `Id harus diawali "${input.parentId}/"`,
        },
      ]);
    }
  }
}

export class CreateRegionUseCase {
  constructor(private readonly repo: RegionRepository) {}

  async execute(input: CreateRegionInput): Promise<Region> {
    assertShape({ id: input.id, type: input.type, parentId: input.parentId });
    const live = await this.repo.findById(input.id);
    if (live) {
      throw new ConflictError('REGION_ID_TAKEN', 'Id wilayah sudah dipakai');
    }
    if (input.type === 'desa' && input.parentId) {
      const parent = await this.repo.findById(input.parentId);
      if (!parent || parent.type !== 'kecamatan') {
        throw new BadRequestError('VALIDATION_ERROR', 'Kecamatan induk tidak ditemukan', [
          { field: 'parent_id', message: 'Pilih kecamatan yang masih ada' },
        ]);
      }
    }
    return this.repo.create(input);
  }
}

export class UpdateRegionUseCase {
  constructor(private readonly repo: RegionRepository) {}

  async execute(input: UpdateRegionInput): Promise<Region> {
    const current = await this.repo.findById(input.id);
    if (!current) {
      throw new NotFoundError('REGION_NOT_FOUND', 'Wilayah tidak ditemukan');
    }
    const parentId = input.parentId !== undefined ? input.parentId : current.parentId;
    assertShape({ id: current.id, type: current.type, parentId });
    if (current.type === 'desa' && parentId) {
      const parent = await this.repo.findById(parentId);
      if (!parent || parent.type !== 'kecamatan') {
        throw new BadRequestError('VALIDATION_ERROR', 'Kecamatan induk tidak ditemukan', [
          { field: 'parent_id', message: 'Pilih kecamatan yang masih ada' },
        ]);
      }
    }
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('REGION_NOT_FOUND', 'Wilayah tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteRegionUseCase {
  constructor(private readonly repo: RegionRepository) {}

  async execute(id: string): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) {
      throw new NotFoundError('REGION_NOT_FOUND', 'Wilayah tidak ditemukan');
    }
    if (current.type === 'kecamatan') {
      const children = await this.repo.countActiveChildren(id);
      if (children > 0) {
        throw new ConflictError(
          'REGION_HAS_CHILDREN',
          'Kecamatan masih punya desa. Hapus atau pindahkan desa dulu.',
        );
      }
    }
    const used = await this.repo.countPlacesUsing(id);
    if (used > 0) {
      throw new ConflictError(
        'REGION_IN_USE',
        'Wilayah masih dipakai wisata. Ubah atau hapus wisata terkait dulu.',
      );
    }
    const ok = await this.repo.softDelete(id);
    if (!ok) {
      throw new NotFoundError('REGION_NOT_FOUND', 'Wilayah tidak ditemukan');
    }
  }
}

export class ListRegionsUseCase {
  constructor(private readonly repo: RegionRepository) {}

  execute(input: ListRegionsInput): Promise<ListRegionsResult> {
    return this.repo.list(input);
  }
}

export class GetRegionByIdUseCase {
  constructor(private readonly repo: RegionRepository) {}

  async execute(id: string, publicOnly = true): Promise<Region> {
    const region = await this.repo.findById(id);
    if (!region || (publicOnly && region.status !== 'published')) {
      throw new NotFoundError('REGION_NOT_FOUND', 'Wilayah tidak ditemukan');
    }
    return region;
  }
}
