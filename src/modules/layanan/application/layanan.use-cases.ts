import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { LayananCategory } from '@/shared/database/drizzle/schema/layanans.schema';
import type { Layanan, LayananFields } from '../domain/layanan';
import { slugifyLayanan } from '../domain/layanan';
import type { LayananRepositoryImpl } from '../infrastructure/layanan.repository.impl';

const PENDING_CAP = 10;

export class LayananUseCases {
  constructor(
    private readonly repo: LayananRepositoryImpl,
    private readonly regions: RegionRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  listPublic(filter: { regionRef?: string; category?: LayananCategory }) {
    return this.repo.listPublic(filter);
  }

  listManage(regionRef?: string) {
    return this.repo.listManage(regionRef);
  }

  async getPublished(slug: string): Promise<Layanan> {
    const row = await this.repo.findPublishedBySlug(slug);
    if (!row) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return row;
  }

  async adminCreate(authorId: string, raw: LayananFields): Promise<Layanan> {
    const fields = await this.normalize(raw);
    const slug = await this.uniqueSlug(fields.name);
    const id = await this.repo.insert({
      slug,
      fields,
      authorId,
      publishStatus: 'published',
    });
    await this.emitPublished(id, fields.name, authorId);
    const created = await this.repo.findById(id);
    if (!created) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return created;
  }

  async adminUpdate(id: string, raw: LayananFields): Promise<Layanan> {
    const current = await this.mustAny(id);
    const fields = await this.normalize(raw);
    await this.repo.update(current.id, fields);
    const next = await this.repo.findById(current.id);
    if (!next) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return next;
  }

  async adminSetPublish(id: string, publishStatus: 'published' | 'unpublished'): Promise<Layanan> {
    await this.mustAny(id);
    await this.repo.update(id, { publishStatus });
    const next = await this.repo.findById(id);
    if (!next) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return next;
  }

  async submit(userId: string, kind: 'new' | 'edit', raw: LayananFields, layananId?: string) {
    const open = await this.repo.countOpenByUser(userId);
    if (open >= PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Kamu masih punya 10 usulan yang menunggu. Selesaikan dulu sebelum mengirim lagi.',
      );
    }
    const fields = await this.normalize(raw);
    let targetId: string | null = null;
    if (kind === 'edit') {
      if (!layananId) {
        throw new BadRequestError('LAYANAN_REQUIRED', 'Pilih layanan yang ingin diperbaiki');
      }
      const target = await this.mustAny(layananId);
      if (target.publishStatus !== 'published') {
        throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
      }
      targetId = target.id;
    }
    const id = await this.repo.insertContribution({
      kind,
      userId,
      layananId: targetId,
      payload: fields,
    });
    const row = await this.repo.findContribution(id);
    if (!row) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    return row;
  }

  listMine(userId: string) {
    return this.repo.listContributions({ userId });
  }

  listAdmin(status?: 'pending' | 'needs_revision' | 'approved' | 'rejected') {
    return this.repo.listContributions({ status });
  }

  async resubmit(userId: string, id: string, raw: LayananFields) {
    const row = await this.mustOwn(userId, id);
    if (row.status !== 'needs_revision') {
      throw new ConflictError('NOT_REVISABLE', 'Usulan ini tidak menunggu perbaikan');
    }
    const fields = await this.normalize(raw);
    await this.repo.updateContribution(id, { status: 'pending', payload: fields, revisionNote: null });
    const next = await this.repo.findContribution(id);
    if (!next) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    return next;
  }

  async cancel(userId: string, id: string) {
    const row = await this.mustOwn(userId, id);
    if (row.status !== 'pending' && row.status !== 'needs_revision') {
      throw new ConflictError('NOT_PENDING', 'Usulan ini sudah ditinjau');
    }
    await this.repo.deleteContribution(row.id);
  }

  async approve(id: string) {
    const row = await this.mustPending(id);
    if (row.kind === 'new') {
      const slug = await this.uniqueSlug(row.payload.name);
      const layananId = await this.repo.insert({
        slug,
        fields: row.payload,
        authorId: row.userId,
        publishStatus: 'published',
      });
      await this.repo.updateContribution(id, {
        status: 'approved',
        resultLayananId: layananId,
        reviewed: true,
      });
      await this.emitPublished(layananId, row.payload.name, row.userId);
      return;
    }
    if (!row.layananId) {
      throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    }
    await this.mustAny(row.layananId);
    await this.repo.update(row.layananId, row.payload);
    await this.repo.updateContribution(id, { status: 'approved', reviewed: true });
  }

  async reject(id: string, reasonCode: string, reasonText?: string | null) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, {
      status: 'rejected',
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
      reviewed: true,
    });
  }

  async requestRevision(id: string, note: string) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, {
      status: 'needs_revision',
      revisionNote: note,
      reviewed: true,
    });
  }

  private async normalize(raw: LayananFields): Promise<LayananFields> {
    const phone = raw.phone.trim();
    if (phone.length < 8 || !/\d/.test(phone)) {
      throw new BadRequestError('PHONE_REQUIRED', 'Nomor telepon wajib diisi');
    }
    const hasLat = raw.lat != null;
    const hasLng = raw.lng != null;
    if (hasLat !== hasLng) {
      throw new BadRequestError('LATLNG_PAIR', 'Latitude dan longitude harus diisi berpasangan');
    }
    const region = await this.regions.findByIdOrSlug(raw.regionId);
    if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
      throw new BadRequestError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
    }
    const village = raw.villageId
      ? await this.regions.findByIdOrSlug(raw.villageId)
      : null;
    if (raw.villageId && (!village || village.type !== 'desa' || village.status !== 'published')) {
      throw new BadRequestError('VILLAGE_NOT_FOUND', 'Desa tidak ditemukan');
    }
    if (village && village.parentId !== region.id) {
      throw new BadRequestError('VILLAGE_MISMATCH', 'Desa bukan bagian dari kecamatan yang dipilih');
    }
    return {
      category: raw.category,
      name: raw.name.trim(),
      phone,
      whatsapp: raw.whatsapp?.trim() || null,
      addressText: raw.addressText?.trim() || null,
      lat: raw.lat ?? null,
      lng: raw.lng ?? null,
      mapsUrl: raw.mapsUrl?.trim() || null,
      regionId: region.id,
      villageId: village?.id ?? null,
      note: raw.note?.trim() || null,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugifyLayanan(name);
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }

  private async mustAny(id: string): Promise<Layanan> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return row;
  }

  private async mustPending(id: string) {
    const row = await this.repo.findContribution(id);
    if (!row) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Usulan ini sudah ditinjau');
    }
    return row;
  }

  private async mustOwn(userId: string, id: string) {
    const row = await this.repo.findContribution(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    return row;
  }

  private async emitPublished(layananId: string, name: string, authorId: string) {
    await this.activityEvents?.safe({
      kind: 'layanan_published',
      actorId: authorId,
      targetId: layananId,
      payload: `Menambahkan layanan publik · "${name}"`,
      dedupeKey: `layanan_published:${layananId}`,
    });
  }
}
