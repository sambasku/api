import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { InboxNotificationType } from '@/modules/notification/domain/entities/notification.entity';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { ActivityEventRepository } from '@/modules/activity/domain/repositories/activity-event.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type {
  CulinaryRepository,
  CreateCuisineInput,
  CreatePlaceInput,
  UpdateCuisineInput,
  UpdatePlaceInput,
} from '@/modules/culinary/domain/repositories/culinary.repository';
import {
  UniqueCulinarySlugUseCase,
  imagesToJson,
} from '@/modules/culinary/application/use-cases/culinary.use-cases';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { composeCulinaryRejectDisplay } from '../domain/culinary-contribution.entity';
import type {
  CuisineEditPayload,
  CulinaryContribution,
  CulinaryContributionKind,
  CulinaryContributionPayload,
  LinkPayload,
  NewCuisinePayload,
  NewPlacePayload,
  PlaceEditPayload,
} from '../domain/culinary-contribution.entity';
import type { CulinaryContributionRepository } from '../domain/culinary-contribution.repository';

const PENDING_CAP = 10;
const MAX_IMAGES = 20;

/**
* Field yang boleh diajukan lewat kind=cuisine_edit. Daftar ini juga dasar
* field-lock: pengajuan pending lain hanya boleh menyentuh bidang berbeda.
*/
export const CUISINE_EDIT_FIELDS = [
  'name',
  'description',
  'categoryId',
  'originRegion',
  'images',
  'ingredients',
  'servingSuggestion',
  'tags',
  'sources',
] as const;

export const PLACE_EDIT_FIELDS = [
  'name',
  'type',
  'description',
  'locationHint',
  'addressText',
  'lat',
  'lng',
  'mapsUrl',
  'phone',
  'whatsapp',
  'website',
  'socialUrl',
  'coverUrl',
] as const;

/** Kanonik ter-sort: dasar pembanding overlap field-lock. */
export function canonicalCulinaryFields(fields: string[]): string {
  return [...new Set(fields)].sort().join(',');
}

function overlaps(a: string, b: string): boolean {
  if (!a || !b) return false;
  const setB = new Set(b.split(','));
  return a.split(',').some((f) => setB.has(f));
}

function decisionCopy(
  kind: 'approved' | 'rejected' | 'needs_revision',
  label: string,
  opts?: {
    rejectReason?: { code: string; text?: string | null };
    revisionNote?: string | null;
  },
): { title: string; body: string } {
  if (kind === 'approved') {
    return {
      title: 'Usulan kuliner disetujui',
      body: `Usulanmu "${label}" sudah diterapkan. Terima kasih!`,
    };
  }
  if (kind === 'needs_revision') {
    const note = opts?.revisionNote ? ` Catatan: ${opts.revisionNote}.` : '';
    return {
      title: 'Usulan kuliner perlu revisi',
      body: `Usulanmu "${label}" perlu diperbaiki dulu.${note} Buka daftar usulan untuk detailnya.`,
    };
  }
  const reason = opts?.rejectReason
    ? ` Alasan: ${composeCulinaryRejectDisplay(opts.rejectReason.code, opts.rejectReason.text)}.`
    : '';
  return {
    title: 'Usulan kuliner ditolak',
    body: `Usulanmu "${label}" ditolak.${reason} Buka daftar usulan untuk detailnya.`,
  };
}

export interface SubmitNewCulinaryInput {
  kind: 'new_cuisine' | 'new_place';
  payload: NewCuisinePayload | NewPlacePayload;
}

export interface SubmitCulinaryChangeInput {
  kind: Exclude<CulinaryContributionKind, 'new_cuisine' | 'new_place'>;
  cuisineId?: string | null;
  placeId?: string | null;
  linkId?: string | null;
  payload: CulinaryContributionPayload;
  /** Field yang diajukan (kind=*_edit). Kosong = deteksi dari payload. */
  fields?: string[];
}

export class CulinaryContributionUseCases {
  constructor(
    private readonly contrib: CulinaryContributionRepository,
    private readonly culinary: CulinaryRepository,
    private readonly uniqueCuisineSlug: UniqueCulinarySlugUseCase,
    private readonly uniquePlaceSlug: UniqueCulinarySlugUseCase,
    private readonly audit?: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly activityEvents?: Pick<ActivityEventRepository, 'append'>,
  ) {}

  // ------------------------------------------------------------- publik --

  /** Usulan kuliner/tempat baru. Anonim diizinkan (rate limit di route). */
  async submit(
    userId: string,
    input: SubmitNewCulinaryInput,
  ): Promise<CulinaryContribution> {
    if (input.kind === 'new_cuisine') {
      await this.assertNewCuisine(input.payload as NewCuisinePayload);
    } else {
      this.assertNewPlace(input.payload as NewPlacePayload);
    }
    const anon = userId === ANONIM_USER_ID;
    if (!anon && (await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Maksimal 10 usulan yang masih menunggu',
      );
    }
    return this.contrib.create({
      kind: input.kind,
      userId,
      lockedFields: '',
      payload: input.payload,
    });
  }

  mine(userId: string) {
    return this.contrib.listByUser(userId);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.status !== 'pending' && row.status !== 'needs_revision') {
      throw new ConflictError('NOT_PENDING', 'Usulan sudah ditinjau');
    }
    await this.contrib.remove(id);
  }

  /** Kirim ulang usulan yang diminta revisi. */
  async resubmit(
    userId: string,
    id: string,
    input: SubmitNewCulinaryInput,
  ): Promise<CulinaryContribution> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.kind !== input.kind) {
      throw new ConflictError(
        'KIND_MISMATCH',
        'Jenis usulan tidak cocok dengan pengajuan aslinya',
      );
    }
    if (row.status !== 'needs_revision') {
      throw new ConflictError('NOT_NEEDS_REVISION', 'Usulan ini tidak menunggu revisi');
    }
    if (input.kind === 'new_cuisine') {
      await this.assertNewCuisine(input.payload as NewCuisinePayload);
    } else {
      this.assertNewPlace(input.payload as NewPlacePayload);
    }
    await this.contrib.replacePayload(id, input.payload, '');
    const updated = await this.contrib.findById(id);
    if (!updated) throw new Error('resubmit gagal - row hilang');
    return updated;
  }

  // --------------------------------------------------- perbaikan data --

  /**
   * Pengajuan perbaikan (edit/link/operational/archive). Field-lock:
   * tolak bila bidang beririsan pengajuan pending lain pada target sama.
   */
  async submitChange(
    userId: string,
    input: SubmitCulinaryChangeInput,
  ): Promise<CulinaryContribution> {
    const locked = this.lockedFieldsFor(input);
    const payload = input.payload;

    if (input.kind === 'cuisine_edit') {
      const cuisine = await this.mustCuisine(input.cuisineId);
      this.assertCuisineEdit(payload as CuisineEditPayload, locked);
      if (locked) {
        const pending = await this.contrib.pendingLockedFieldsForCuisine(cuisine.id);
        if (pending.some((other) => overlaps(locked, other))) {
          throw new ConflictError(
            'PENDING_FIELD_LOCK',
            'Ada pengajuan lain yang sedang meninjau bagian yang sama. Tunggu keputusannya dulu ya.',
          );
        }
      }
      return this.createChange(userId, input, locked, cuisine.createdAt, {
        cuisineId: cuisine.id,
        updatedAt: cuisine.updatedAt,
      });
    }

    if (input.kind === 'place_edit') {
      const place = await this.mustPlace(input.placeId);
      this.assertPlaceEdit(payload as PlaceEditPayload, locked);
      if (locked) {
        const pending = await this.contrib.pendingLockedFieldsForPlace(place.id);
        if (pending.some((other) => overlaps(locked, other))) {
          throw new ConflictError(
            'PENDING_FIELD_LOCK',
            'Ada pengajuan lain yang sedang meninjau bagian yang sama. Tunggu keputusannya dulu ya.',
          );
        }
      }
      return this.createChange(userId, input, locked, place.createdAt, {
        placeId: place.id,
        updatedAt: place.updatedAt,
      });
    }

    if (input.kind === 'link') {
      const p = payload as LinkPayload;
      if (!p.cuisineSlug?.trim() || !p.placeSlug?.trim()) {
        throw new BadRequestError(
          'LINK_TARGET_REQUIRED',
          'Kuliner dan tempat wajib dipilih',
          [
            { field: 'cuisine_slug', message: 'Pilih kuliner dulu ya' },
            { field: 'place_slug', message: 'Pilih tempat dulu ya' },
          ],
        );
      }
      const cuisine = await this.culinary.findCuisineBySlug(p.cuisineSlug, {
        publicOnly: true,
      });
      if (!cuisine) {
        throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      }
      const place = await this.culinary.findPlaceBySlug(p.placeSlug, {
        publicOnly: true,
      });
      if (!place) {
        throw new NotFoundError('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
      }
      const existing = await this.culinary.findLinkByPair(cuisine.id, place.id);
      if (existing) {
        throw new ConflictError(
          'LINK_EXISTS',
          'Hubungan kuliner dan tempat ini sudah ada',
        );
      }
      return this.contrib.create({
        kind: 'link',
        userId,
        cuisineId: cuisine.id,
        placeId: place.id,
        lockedFields: `link:${cuisine.id}:${place.id}`,
        payload: { ...p, cuisineSlug: cuisine.slug, placeSlug: place.slug },
        baseUpdatedAt: place.updatedAt ?? place.createdAt,
      });
    }

    if (input.kind === 'place_operational') {
      const place = await this.mustPlace(input.placeId);
      const status = (payload as { operationalStatus?: string }).operationalStatus;
      if (!status) {
        throw new BadRequestError(
          'OPERATIONAL_STATUS_REQUIRED',
          'Status operasional wajib diisi',
        );
      }
      const pending = await this.contrib.pendingLockedFieldsForPlace(place.id);
      if (pending.some((other) => overlaps('operationalStatus', other))) {
        throw new ConflictError(
          'PENDING_FIELD_LOCK',
          'Status operasional tempat ini sedang ditinjau. Tunggu keputusannya dulu ya.',
        );
      }
      return this.contrib.create({
        kind: 'place_operational',
        userId,
        placeId: place.id,
        lockedFields: 'operationalStatus',
        payload,
        baseUpdatedAt: place.updatedAt ?? place.createdAt,
      });
    }

    if (input.kind === 'link_edit') {
      if (!input.linkId) {
        throw new BadRequestError('LINK_REQUIRED', 'Relasi wajib dipilih');
      }
      const link = await this.culinary.findLinkById(input.linkId);
      if (!link) {
        throw new NotFoundError('LINK_NOT_FOUND', 'Relasi tidak ditemukan');
      }
      return this.contrib.create({
        kind: 'link_edit',
        userId,
        cuisineId: link.cuisineId,
        placeId: link.placeId,
        linkId: link.id,
        lockedFields: `link:${link.cuisineId}:${link.placeId}`,
        payload,
      });
    }

    if (input.kind === 'archive' || input.kind === 'restore') {
      if (input.cuisineId) {
        const cuisine = await this.mustCuisine(input.cuisineId);
        return this.contrib.create({
          kind: input.kind,
          userId,
          cuisineId: cuisine.id,
          lockedFields: 'publishStatus',
          payload,
          baseUpdatedAt: cuisine.updatedAt ?? cuisine.createdAt,
        });
      }
      const place = await this.mustPlace(input.placeId);
      return this.contrib.create({
        kind: input.kind,
        userId,
        placeId: place.id,
        lockedFields: 'publishStatus',
        payload,
        baseUpdatedAt: place.updatedAt ?? place.createdAt,
      });
    }

    throw new BadRequestError('KIND_INVALID', 'Jenis pengajuan tidak dikenali');
  }

  // ------------------------------------------------------------- admin --

  list(filter: {
    status?: 'pending' | 'needs_revision' | 'approved' | 'rejected';
    kind?: CulinaryContributionKind;
  }) {
    return this.contrib.list(filter);
  }

  /**
   * Approve per kind. `mustPending` guard bikin idempoten: klik ganda
   * tidak pernah membuat entitas dobel.
   */
  async approve(
    id: string,
    actorId?: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.mustPending(id);

    if (row.kind === 'new_cuisine') {
      const p = row.payload as NewCuisinePayload;
      const slug = await this.uniqueCuisineSlug.execute(p.name);
      const cuisine = await this.culinary.createCuisine({
        slug,
        name: p.name,
        description: p.description ?? null,
        categoryId: p.categoryId ?? null,
        originRegion: p.originRegion ?? null,
        imagesJson: imagesToJson(p.images),
        ingredientsJson: p.ingredients?.length
          ? JSON.stringify(p.ingredients)
          : null,
        servingSuggestion: p.servingSuggestion ?? null,
        tagsJson: p.tags?.length ? JSON.stringify(p.tags) : null,
        sourcesJson: p.sources?.length ? JSON.stringify(p.sources) : null,
        publishStatus: 'published',
        authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
      } satisfies CreateCuisineInput);
      await this.contrib.setStatus(id, 'approved', { resultCuisineId: cuisine.id });
      await this.emitPublished('cuisine', cuisine.id, cuisine.name, row.userId);
      await this.audit?.record({
        userId: actorId ?? null,
        action: 'culinary.contribution.approve',
        entityType: 'cuisine',
        entityId: cuisine.id,
        newData: { kind: 'new_cuisine', contribution_id: id, name: p.name },
        requestId: requestId ?? null,
      });
      await this.notifyDecision(row, 'approved', p.name, undefined, actorId);
      return;
    }

    if (row.kind === 'new_place') {
      const p = row.payload as NewPlacePayload;
      const slug = await this.uniquePlaceSlug.execute(p.name);
      const place = await this.culinary.createPlace({
        slug,
        name: p.name,
        type: p.type ?? null,
        description: p.description ?? null,
        locationHint: p.locationHint ?? null,
        addressText: p.addressText ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        mapsUrl: p.mapsUrl ?? null,
        phone: p.phone ?? null,
        whatsapp: p.whatsapp ?? null,
        website: p.website ?? null,
        socialUrl: p.socialUrl ?? null,
        coverUrl: p.coverUrl ?? null,
        publishStatus: 'published',
        authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
      } satisfies CreatePlaceInput);
      await this.contrib.setStatus(id, 'approved', { resultPlaceId: place.id });
      await this.emitPublished('place', place.id, place.name, row.userId);
      await this.audit?.record({
        userId: actorId ?? null,
        action: 'culinary.contribution.approve',
        entityType: 'culinary_place',
        entityId: place.id,
        newData: { kind: 'new_place', contribution_id: id, name: p.name },
        requestId: requestId ?? null,
      });
      await this.notifyDecision(row, 'approved', p.name, undefined, actorId);
      return;
    }

    // Kind lain menyentuh entitas yang sudah ada -> stale check dulu.
    const label = await this.assertNotStale(row);

    switch (row.kind) {
      case 'cuisine_edit': {
        const p = row.payload as CuisineEditPayload;
        const fields = row.lockedFields ? row.lockedFields.split(',') : [];
        const patch: UpdateCuisineInput = { id: row.cuisineId! };
        for (const f of fields) {
          if (f === 'images' && p.images !== undefined) {
            patch.imagesJson = imagesToJson(p.images);
          } else if (f === 'ingredients' && p.ingredients !== undefined) {
            patch.ingredientsJson = JSON.stringify(p.ingredients);
          } else if (f === 'tags' && p.tags !== undefined) {
            patch.tagsJson = JSON.stringify(p.tags);
          } else if (f === 'sources' && p.sources !== undefined) {
            patch.sourcesJson = JSON.stringify(p.sources);
          } else if (f in p) {
            (patch as unknown as Record<string, unknown>)[f] = (
              p as Record<string, unknown>
            )[f];
          }
        }
        await this.culinary.updateCuisine(patch);
        break;
      }
      case 'place_edit': {
        const p = row.payload as PlaceEditPayload;
        const fields = row.lockedFields ? row.lockedFields.split(',') : [];
        const patch: UpdatePlaceInput = { id: row.placeId! };
        for (const f of fields) {
          if (f in p) {
            (patch as unknown as Record<string, unknown>)[f] = (
              p as Record<string, unknown>
            )[f];
          }
        }
        await this.culinary.updatePlace(patch);
        break;
      }
      case 'link': {
        const p = row.payload as LinkPayload;
        if (row.cuisineId && row.placeId) {
          await this.culinary.createLink({
            cuisineId: row.cuisineId,
            placeId: row.placeId,
            availability: p.availability ?? 'unknown',
            note: p.note ?? null,
            publishStatus: 'published',
            authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
          });
        }
        break;
      }
      case 'link_edit': {
        if (!row.linkId) {
          throw new BadRequestError('LINK_REQUIRED', 'Relasi wajib dipilih');
        }
        const p = row.payload as {
          availability?: LinkPayload['availability'];
          note?: string | null;
        };
        // Dimensi relasi: publish_status relasi TIDAK berubah.
        await this.culinary.updateLink({
          id: row.linkId,
          availability: p.availability,
          note: p.note,
        });
        break;
      }
      case 'place_operational': {
        const status = (row.payload as { operationalStatus: string })
          .operationalStatus;
        // Dimensi terpisah: publish_status TIDAK berubah (PRD 9).
        await this.culinary.updatePlace({
          id: row.placeId!,
          operationalStatus: status as never,
        });
        break;
      }
      case 'archive': {
        if (row.cuisineId) {
          await this.culinary.updateCuisine({
            id: row.cuisineId,
            publishStatus: 'archived',
          });
        } else if (row.placeId) {
          await this.culinary.updatePlace({
            id: row.placeId,
            publishStatus: 'archived',
          });
        }
        break;
      }
      case 'restore': {
        if (row.cuisineId) {
          await this.culinary.updateCuisine({
            id: row.cuisineId,
            publishStatus: 'published',
            restricted: null,
          });
        } else if (row.placeId) {
          await this.culinary.updatePlace({
            id: row.placeId,
            publishStatus: 'published',
            restricted: null,
          });
        }
        break;
      }
      default:
        break;
    }

    // Relasi baru juga jejak publik (kuliner tersedia di tempat).
    if (row.kind === 'link' && row.cuisineId) {
      const cuisine = await this.culinary.findCuisineById(row.cuisineId);
      if (cuisine) {
        await this.emitPublished(
          'cuisine',
          cuisine.id,
          cuisine.name,
          row.userId,
          `cuisine_link:${row.id}`,
        );
      }
    }

    await this.contrib.setStatus(id, 'approved');
    await this.audit?.record({
      userId: actorId ?? null,
      action: 'culinary.contribution.approve',
      entityType: row.cuisineId ? 'cuisine' : 'culinary_place',
      entityId: row.cuisineId ?? row.placeId ?? id,
      newData: { kind: row.kind, contribution_id: id },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(row, 'approved', label, undefined, actorId);
  }

  async reject(
    id: string,
    reasonCode: string,
    reasonText?: string | null,
    actorId?: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.mustPending(id);
    await this.contrib.setStatus(id, 'rejected', {
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
    });
    await this.audit?.record({
      userId: actorId ?? null,
      action: 'culinary.contribution.reject',
      entityType: row.cuisineId ? 'cuisine' : 'culinary_place',
      entityId: row.cuisineId ?? row.placeId ?? id,
      newData: { kind: row.kind, contribution_id: id, reason_code: reasonCode },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(
      row,
      'rejected',
      this.labelOf(row),
      { rejectReason: { code: reasonCode, text: reasonText } },
      actorId,
    );
  }

  async requestRevision(
    id: string,
    note: string,
    actorId?: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.mustPending(id);
    await this.contrib.setStatus(id, 'needs_revision', { revisionNote: note });
    await this.audit?.record({
      userId: actorId ?? null,
      action: 'culinary.contribution.request_revision',
      entityType: row.cuisineId ? 'cuisine' : 'culinary_place',
      entityId: row.cuisineId ?? row.placeId ?? id,
      newData: { kind: row.kind, contribution_id: id },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(
      row,
      'needs_revision',
      this.labelOf(row),
      { revisionNote: note },
      actorId,
    );
  }

  // ------------------------------------------------------------- private --

  private async createChange(
    userId: string,
    input: SubmitCulinaryChangeInput,
    locked: string,
    _createdAt: Date,
    target: { cuisineId?: string; placeId?: string; updatedAt: Date | null },
  ): Promise<CulinaryContribution> {
    return this.contrib.create({
      kind: input.kind,
      userId,
      cuisineId: target.cuisineId ?? null,
      placeId: target.placeId ?? null,
      lockedFields: locked,
      payload: input.payload,
      baseUpdatedAt: target.updatedAt ?? _createdAt,
    });
  }

  private lockedFieldsFor(input: SubmitCulinaryChangeInput): string {
    switch (input.kind) {
      case 'cuisine_edit': {
        const p = input.payload as Record<string, unknown>;
        const declared = input.fields?.length
          ? input.fields
          : CUISINE_EDIT_FIELDS.filter((f) => f in p);
        const unknown = declared.filter(
          (f) => !(CUISINE_EDIT_FIELDS as readonly string[]).includes(f),
        );
        if (unknown.length > 0) {
          throw new BadRequestError(
            'UNKNOWN_FIELD',
            `Field tidak bisa diajukan: ${unknown.join(', ')}`,
          );
        }
        return canonicalCulinaryFields(declared);
      }
      case 'place_edit': {
        const p = input.payload as Record<string, unknown>;
        const declared = input.fields?.length
          ? input.fields
          : PLACE_EDIT_FIELDS.filter((f) => f in p);
        const unknown = declared.filter(
          (f) => !(PLACE_EDIT_FIELDS as readonly string[]).includes(f),
        );
        if (unknown.length > 0) {
          throw new BadRequestError(
            'UNKNOWN_FIELD',
            `Field tidak bisa diajukan: ${unknown.join(', ')}`,
          );
        }
        return canonicalCulinaryFields(declared);
      }
      case 'place_operational':
        return 'operationalStatus';
      case 'archive':
      case 'restore':
        return 'publishStatus';
      default:
        return '';
    }
  }

  private async assertNewCuisine(p: NewCuisinePayload): Promise<void> {
    if (!p.name?.trim() || p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama kuliner minimal 2 karakter',
        [{ field: 'name', message: 'Tulis nama kuliner dulu ya' }],
      );
    }
    if ((p.images?.length ?? 0) > MAX_IMAGES) {
      throw new BadRequestError(
        'TOO_MANY_IMAGES',
        `Maksimal ${MAX_IMAGES} gambar per usulan`,
      );
    }
    this.assertImageAttribution(p.images);
    if (p.categoryId) {
      const category = await this.culinary.categoryRef(p.categoryId);
      if (!category) {
        throw new BadRequestError(
          'CATEGORY_NOT_FOUND',
          'Kategori kuliner tidak ditemukan',
        );
      }
    }
  }

  private assertNewPlace(p: NewPlacePayload): void {
    if (!p.name?.trim() || p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama tempat minimal 2 karakter',
        [{ field: 'name', message: 'Tulis nama tempat dulu ya' }],
      );
    }
    if ((p.lat != null) !== (p.lng != null)) {
      throw new BadRequestError(
        'LATLNG_PAIR',
        'Latitude dan longitude harus diisi berpasangan',
      );
    }
  }

  private assertImageAttribution(
    images: NewCuisinePayload['images'] | undefined,
  ): void {
    for (const img of images ?? []) {
      if (!img.attribution?.name || !img.attribution?.license) {
        throw new BadRequestError(
          'ATTRIBUTION_REQUIRED',
          'Setiap gambar wajib punya sumber dan lisensi',
          [
            {
              field: 'images',
              message: 'Lengkapi nama pemilik dan lisensi gambar',
            },
          ],
        );
      }
    }
  }

  private assertCuisineEdit(p: CuisineEditPayload, locked: string): void {
    if (!locked) {
      throw new BadRequestError(
        'EMPTY_CHANGE',
        'Tidak ada perubahan yang diajukan',
      );
    }
    if (p.name !== undefined && p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama kuliner minimal 2 karakter',
      );
    }
    this.assertImageAttribution(p.images);
  }

  private assertPlaceEdit(p: PlaceEditPayload, locked: string): void {
    if (!locked) {
      throw new BadRequestError(
        'EMPTY_CHANGE',
        'Tidak ada perubahan yang diajukan',
      );
    }
    if (p.name !== undefined && p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama tempat minimal 2 karakter',
      );
    }
    if ((p.lat != null) !== (p.lng != null)) {
      throw new BadRequestError(
        'LATLNG_PAIR',
        'Latitude dan longitude harus diisi berpasangan',
      );
    }
  }

  private async mustCuisine(cuisineId: string | null | undefined) {
    if (!cuisineId) {
      throw new BadRequestError('CUISINE_REQUIRED', 'Kuliner wajib dipilih');
    }
    const cuisine = await this.culinary.findCuisineById(cuisineId);
    if (!cuisine) {
      throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
    }
    return cuisine;
  }

  private async mustPlace(placeId: string | null | undefined) {
    if (!placeId) {
      throw new BadRequestError('PLACE_REQUIRED', 'Tempat wajib dipilih');
    }
    const place = await this.culinary.findPlaceById(placeId);
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
    }
    return place;
  }

  private async mustPending(id: string): Promise<CulinaryContribution> {
    const row = await this.contrib.findById(id);
    if (!row) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Pengajuan tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Pengajuan sudah ditinjau');
    }
    return row;
  }

  /** Stale check: tolak bila target berubah sejak pengajuan dibuat. */
  private async assertNotStale(row: CulinaryContribution): Promise<string> {
    const target = row.cuisineId
      ? await this.culinary.findCuisineById(row.cuisineId)
      : row.placeId
        ? await this.culinary.findPlaceById(row.placeId)
        : null;
    if (!target) {
      throw new NotFoundError('TARGET_NOT_FOUND', 'Data target tidak ditemukan');
    }
    if (
      row.baseUpdatedAt &&
      target.updatedAt &&
      target.updatedAt.getTime() > row.baseUpdatedAt.getTime()
    ) {
      throw new ConflictError(
        'STALE_DATA',
        'Data sudah berubah sejak pengajuan dibuat. Minta pengusul mengajukan ulang.',
      );
    }
    return target.name;
  }

  private labelOf(row: CulinaryContribution): string {
    return (
      (row.payload as { name?: string }).name ??
      (row.cuisineId ? 'perubahan kuliner' : 'perubahan tempat')
    );
  }

  /** Activity event publik (AGENTS.md #25) - best-effort. */
  private async emitPublished(
    entity: 'cuisine' | 'place',
    id: string,
    name: string,
    authorId: string,
    dedupeSuffix?: string,
  ): Promise<void> {
    // Satu kind untuk modul kuliner (kuliner & tempat kuliner): targetId
    // membedakan entitas, body membedakan jenis. `place_published` sudah
    // dipakai wisata (AGENTS.md #25) - jangan ditumpuk.
    const body =
      entity === 'cuisine'
        ? `Menambahkan kuliner · "${name}"`
        : `Menambahkan tempat kuliner · "${name}"`;
    try {
      await this.activityEvents?.append({
        kind: 'cuisine_published',
        actorId: authorId === ANONIM_USER_ID ? null : authorId,
        targetId: id,
        payload: body,
        dedupeKey: `${dedupeSuffix ?? `cuisine_published:${id}`}`,
      });
    } catch {
      /* best-effort */
    }
  }

  private async notifyDecision(
    row: CulinaryContribution,
    kind: 'approved' | 'rejected' | 'needs_revision',
    label: string,
    opts: {
      rejectReason?: { code: string; text?: string | null };
      revisionNote?: string | null;
    } | undefined,
    actorId?: string,
  ): Promise<void> {
    if (!row.userId || row.userId === ANONIM_USER_ID) return;
    if (actorId && actorId === row.userId) return;
    const copy = decisionCopy(kind, label, opts);
    const type: InboxNotificationType =
      kind === 'approved'
        ? 'culinary_contribution_approved'
        : kind === 'rejected'
          ? 'culinary_contribution_rejected'
          : 'culinary_contribution_needs_revision';
    try {
      await this.inbox?.execute({
        userId: row.userId,
        type,
        targetKind: 'culinary_contribution',
        targetId: row.id,
        title: copy.title,
        body: copy.body,
        actionKind: 'culinary_contribution',
        actionValue: row.id,
        actorId,
      });
      await this.notifyUser?.execute({
        userId: row.userId,
        title: copy.title,
        body: copy.body,
        data: {
          type,
          target_kind: 'culinary_contribution',
          target_id: row.id,
        },
        actorId,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'notifikasi keputusan pengajuan kuliner gagal',
          contribution_id: row.id,
          kind,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
