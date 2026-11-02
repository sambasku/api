import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { InboxNotificationType } from '@/modules/notification/domain/entities/notification.entity';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import {
  assertOurPlaceImage,
  CreatePlaceUseCase,
  UpdatePlaceUseCase,
} from '@/modules/place/application/use-cases/place.use-cases';
import type { PlaceRepository } from '@/modules/place/domain/repositories/place.repository';
import type { PlaceCategoryRepository } from '@/modules/place-category/domain/repositories/place-category.repository';
import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { composePlaceRejectDisplay } from '../domain/place-reject-reason';
import type {
  ContributionPayload,
  PlaceContribution,
  PlaceContributionRepositoryImpl,
} from '../infrastructure/place-contribution.repository.impl';

const PENDING_CAP = 10;

/** Copy notifikasi inbox + FCM untuk keputusan usulan wisata. */
function decisionCopy(
  kind: 'approved' | 'rejected',
  name: string,
  rejectReason?: { code: string; text?: string | null },
): { title: string; body: string } {
  if (kind === 'approved') {
    return {
      title: 'Usulan wisata disetujui',
      body: `Usulanmu "${name}" sudah tayang di daftar wisata. Terima kasih!`,
    };
  }
  const reason = rejectReason
    ? ` Alasan: ${composePlaceRejectDisplay(rejectReason.code, rejectReason.text)}.`
    : '';
  return {
    title: 'Usulan wisata ditolak',
    body: `Usulanmu "${name}" ditolak.${reason} Buka daftar usulan untuk detailnya.`,
  };
}

export class PlaceContributionUseCases {
  constructor(
    private readonly contrib: PlaceContributionRepositoryImpl,
    private readonly places: PlaceRepository,
    private readonly categories: PlaceCategoryRepository,
    private readonly regions: RegionRepository,
    private readonly users: UserRepository,
    private readonly createPlace: CreatePlaceUseCase,
    private readonly updatePlace: UpdatePlaceUseCase,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
  ) {}

  async submit(userId: string, placeId: string | null, payload: ContributionPayload): Promise<PlaceContribution> {
    const normalized = await this.assertPayload(payload);
    const anon = userId === ANONIM_USER_ID;
    if (!anon && (await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError('PENDING_CAP', 'Maksimal 10 usulan yang masih menunggu');
    }
    let base: Date | null = null;
    const place = placeId ? await this.loadPlace(placeId) : null;
    if (placeId) {
      if (!place || place.status === 'archived') {
        throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
      }
      if (!anon && (await this.contrib.findPendingEdit(userId, place.id))) {
        throw new ConflictError('PENDING_EXISTS', 'Kamu sudah punya usulan suntingan untuk tempat ini');
      }
      base = place.updatedAt;
    }
    return this.contrib.create({
      userId,
      placeId: place?.id ?? null,
      baseUpdatedAt: base,
      payload: normalized,
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

  async approve(id: string, actorId?: string): Promise<void> {
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
        // Slug usulan bisa bentrok (auto-slug dari nama di klien): ambil
        // slug unik dari nama, bukan pakai mentah - approve kedua untuk
        // nama sama tidak boleh gagal SLUG_TAKEN (pola event/usaha).
        slug: await this.uniqueSlug(row.payload.name),
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
    await this.notifyDecision(row, 'approved', undefined, actorId);
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
await this.notifyDecision(row, 'approved', undefined, actorId);
}

async reject(id: string, reasonCode: string, reasonText?: string | null, actorId?: string): Promise<void> {
  const row = await this.mustPending(id);
  await this.contrib.setStatus(id, 'rejected', { code: reasonCode, text: reasonText });
  await this.notifyDecision(row, 'rejected', { code: reasonCode, text: reasonText }, actorId);
}

/**
 * Inbox + FCM push ke pengusul. Best-effort setelah keputusan tersimpan:
 * notifikasi gagal tidak membatalkan approve/reject. Anonim & self-review
 * di-skip di dalam use case masing-masing.
 */
  private async notifyDecision(
    row: PlaceContribution,
    kind: 'approved' | 'rejected',
    rejectReason?: { code: string; text?: string | null },
    actorId?: string,
  ): Promise<void> {
    // Self-review (admin menyetujui/menolak usulannya sendiri) = tanpa notif.
    if (actorId && actorId === row.userId) return;
    const copy = decisionCopy(kind, row.payload.name, rejectReason);
  const type: InboxNotificationType =
    kind === 'approved' ? 'place_contribution_approved' : 'place_contribution_rejected';
  const data = {
    type,
    target_kind: 'place_contribution',
    target_id: row.id,
    place_slug: row.payload.slug,
  };
  try {
    await this.inbox?.execute({
      userId: row.userId,
      type,
      targetKind: 'place_contribution',
      targetId: row.id,
      title: copy.title,
      body: copy.body,
      actionKind: 'place_contribution',
      actionValue: row.id,
      actorId,
    });
    await this.notifyUser?.execute({
      userId: row.userId,
      title: copy.title,
      body: copy.body,
      data,
      actorId,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'notifikasi keputusan usulan wisata gagal',
        contribution_id: row.id,
        kind,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

  private async mustPending(id: string): Promise<PlaceContribution> {
    const row = await this.contrib.findById(id);
    if (!row) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') throw new ConflictError('NOT_PENDING', 'Usulan sudah ditinjau');
    return row;
  }

  /**
   * Slug unik dari nama. Semua kandidat dicek dalam SATU query IN (bukan loop
   * query per kandidat - rule subrequest).
   */
  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '') || 'wisata';
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.places.existingSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }

  private async loadPlace(idOrSlug: string) {
    return (await this.places.findById(idOrSlug)) ?? (await this.places.findBySlugAny(idOrSlug));
  }

  private async assertPayload(payload: ContributionPayload): Promise<ContributionPayload> {
    const hasLat = payload.lat != null;
    const hasLng = payload.lng != null;
    if (hasLat !== hasLng) {
      throw new BadRequestError('LATLNG_PAIR', 'Latitude dan longitude harus diisi berpasangan');
    }
    const category = await this.categories.findById(payload.category);
    if (!category || category.status !== 'published') {
      throw new BadRequestError('CATEGORY_NOT_FOUND', 'Kategori tidak ditemukan');
    }
    // Katalog publik `regions` memakai slug sebagai `id`-nya (mobile kirim
    // apa adanya), sedangkan kolom FK menyimpan ULID. Normalisasi ke ULID
    // supaya perbandingan induk desa-kecamatan akurat (pola usaha).
    const region = payload.regionId
      ? await this.regions.findByIdOrSlug(payload.regionId)
      : null;
    if (payload.regionId && (!region || region.type !== 'kecamatan' || region.status !== 'published')) {
      throw new BadRequestError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
    }
    const village = payload.villageId
      ? await this.regions.findByIdOrSlug(payload.villageId)
      : null;
    if (payload.villageId && (!village || village.type !== 'desa' || village.status !== 'published')) {
      throw new BadRequestError('VILLAGE_NOT_FOUND', 'Desa tidak ditemukan');
    }
    if (region && village && village.parentId !== region.id) {
      throw new BadRequestError('VILLAGE_MISMATCH', 'Desa bukan bagian dari kecamatan yang dipilih');
    }
    if (payload.images.length > 20) {
      throw new BadRequestError('IMAGE_CAP', 'Maksimal 20 foto per usulan');
    }
    for (const img of payload.images) assertOurPlaceImage(img.url);
    return {
      ...payload,
      regionId: region?.id ?? payload.regionId,
      villageId: village?.id ?? payload.villageId,
    };
  }
}
