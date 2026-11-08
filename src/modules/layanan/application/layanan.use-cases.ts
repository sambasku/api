import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { Layanan, LayananFields, LayananPhone } from '../domain/layanan';
import { LAYANAN_PHONES_MAX, LAYANAN_PHONES_MIN, slugifyLayanan } from '../domain/layanan';
import type { LayananRepositoryImpl } from '../infrastructure/layanan.repository.impl';

const PENDING_CAP = 10;

export class LayananUseCases {
  constructor(
    private readonly repo: LayananRepositoryImpl,
    private readonly regions: RegionRepository,
    private readonly activity: RecordActivityEventUseCase,
  ) {}

  listPublic(input: { regionRef?: string; category?: Layanan['category'] }) {
    return this.repo.listPublic(input);
  }

  listManage() {
    return this.repo.listManage();
  }

  async getPublished(slug: string): Promise<Layanan> {
    const row = await this.repo.findPublishedBySlug(slug);
    if (!row) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
    return row;
  }

  async adminCreate(fields: LayananFields, authorId: string): Promise<Layanan> {
    const normalized = await this.normalize(fields);
    const slug = await this.uniqueSlug(normalized.name);
    const row = await this.repo.insert({ ...normalized, slug, authorId });
    await this.emitPublished(row);
    return row;
  }

  async adminUpdate(id: string, fields: LayananFields): Promise<Layanan> {
    const current = await this.mustLayanan(id);
    const normalized = await this.normalize(fields);
    await this.repo.update(id, normalized);
    return (await this.repo.findById(current.id))!;
  }

  async adminSetPublish(id: string, published: boolean): Promise<void> {
    await this.mustLayanan(id);
    await this.repo.update(id, { publishStatus: published ? 'published' : 'unpublished' });
  }

  async submit(userId: string, fields: LayananFields, kind: 'new' | 'edit', layananId?: string | null) {
    if ((await this.repo.countOpenByUser(userId)) >= PENDING_CAP) {
      throw new ConflictError('PENDING_CAP', 'Kamu masih punya 10 usulan yang belum selesai');
    }
    const normalized = await this.normalize(fields);
    if (kind === 'edit') {
      if (!layananId) {
        throw new ValidationError([{ field: 'layanan_id', message: 'Usulan perbaikan butuh layanan yang dituju' }]);
      }
      await this.mustLayanan(layananId);
    }
    const id = await this.repo.insertContribution({
      kind,
      userId,
      layananId: kind === 'edit' ? layananId! : null,
      payload: normalized,
    });
    return (await this.repo.findContribution(id))!;
  }

  listMine(userId: string) {
    return this.repo.listContributions({ userId });
  }

  listAdmin(status?: Layanan['publishStatus'] | 'pending' | 'needs_revision' | 'approved' | 'rejected') {
    return this.repo.listContributions({
      status: status as 'pending' | 'needs_revision' | 'approved' | 'rejected' | undefined,
    });
  }

  async resubmit(id: string, userId: string, fields: LayananFields) {
    const row = await this.mustOwnOpen(id, userId);
    if (row.status !== 'needs_revision') {
      throw new ConflictError('NOT_REVISABLE', 'Usulan ini tidak sedang menunggu perbaikan');
    }
    const normalized = await this.normalize(fields);
    await this.repo.updateContribution(id, {
      payload: normalized,
      status: 'pending',
      revisionNote: null,
    });
    return (await this.repo.findContribution(id))!;
  }

  async cancel(id: string, userId: string): Promise<void> {
    await this.mustOwnOpen(id, userId);
    await this.repo.deleteContribution(id);
  }

  async approve(id: string) {
    const row = await this.mustPending(id);
    if (row.kind === 'edit') {
      if (!row.layananId) throw new NotFoundError('LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan');
      await this.mustLayanan(row.layananId);
      await this.repo.update(row.layananId, row.payload);
      await this.repo.updateContribution(id, { status: 'approved', resultLayananId: row.layananId });
      return;
    }
    const slug = await this.uniqueSlug(row.payload.name);
    const created = await this.repo.insert({ ...row.payload, slug, authorId: row.userId });
    await this.repo.updateContribution(id, { status: 'approved', resultLayananId: created.id });
    await this.emitPublished(created);
  }

  async reject(id: string, reasonCode: string, reasonText?: string | null) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, {
      status: 'rejected',
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
    });
  }

  async requestRevision(id: string, note: string) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, { status: 'needs_revision', revisionNote: note });
  }

  private async normalize(fields: LayananFields): Promise<LayananFields> {
    if (fields.phones.length < LAYANAN_PHONES_MIN || fields.phones.length > LAYANAN_PHONES_MAX) {
      throw new ValidationError([
        {
          field: 'phones',
          message: `Isi ${LAYANAN_PHONES_MIN} sampai ${LAYANAN_PHONES_MAX} nomor telepon`,
        },
      ]);
    }
    const phones: LayananPhone[] = [];
    for (let i = 0; i < fields.phones.length; i++) {
      const raw = fields.phones[i]!;
      const phone = raw.phone.trim();
      if (!/\d/.test(phone)) {
        throw new ValidationError([
          { field: `phones.${i}.phone`, message: 'Nomor telepon wajib berisi angka' },
        ]);
      }
      phones.push({
        phone,
        note: raw.note?.trim() || null,
        whatsapp: raw.whatsapp?.trim() || null,
      });
    }
    let logoUrl = fields.logoUrl?.trim() || null;
    if (logoUrl) {
      try {
        const parsed = new URL(logoUrl);
        if (parsed.protocol !== 'https:') {
          throw new ValidationError([
            { field: 'logo_url', message: 'Logo harus memakai tautan https' },
          ]);
        }
        logoUrl = parsed.toString();
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError([{ field: 'logo_url', message: 'Tautan logo tidak valid' }]);
      }
    }
    const hasLat = fields.lat != null;
    const hasLng = fields.lng != null;
    if (hasLat !== hasLng) {
      throw new ConflictError('LATLNG_PAIR', 'Latitude dan longitude harus diisi berpasangan');
    }
    const region = await this.regions.findByIdOrSlug(fields.regionId);
    if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
      throw new NotFoundError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
    }
    let villageId: string | null = null;
    if (fields.villageId) {
      const village = await this.regions.findByIdOrSlug(fields.villageId);
      if (!village || village.type !== 'desa' || village.parentId !== region.id) {
        throw new ConflictError('VILLAGE_MISMATCH', 'Desa itu bukan bagian dari kecamatan ini');
      }
      villageId = village.id;
    }
    return {
      category: fields.category,
      name: fields.name.trim(),
      phones,
      logoUrl,
      addressText: fields.addressText?.trim() || null,
      lat: fields.lat,
      lng: fields.lng,
      mapsUrl: fields.mapsUrl?.trim() || null,
      regionId: region.id,
      villageId,
      note: fields.note?.trim() || null,
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugifyLayanan(name);
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingSlugs(candidates);
    const free = candidates.find((c) => !taken.has(c));
    return free ?? `${base}-${Date.now()}`;
  }

  private async emitPublished(row: Layanan): Promise<void> {
    await this.activity.safe({
      kind: 'layanan_published',
      actorId: row.authorId,
      targetId: row.id,
      payload: `Menambahkan layanan publik · "${row.name}"`,
      dedupeKey: `layanan_published:${row.id}`,
    });
  }

  private async mustLayanan(id: string): Promise<Layanan> {
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

  private async mustOwnOpen(id: string, userId: string) {
    const row = await this.repo.findContribution(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.status !== 'pending' && row.status !== 'needs_revision') {
      throw new ConflictError('NOT_OPEN', 'Usulan ini sudah ditutup');
    }
    return row;
  }
}
