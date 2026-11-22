import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { InboxNotificationType } from '@/modules/notification/domain/entities/notification.entity';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { ActivityEventRepository } from '@/modules/activity/domain/repositories/activity-event.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type {
  CulinaryRepository,
  CreateCuisineInput,
  UpdateCuisineInput,
} from '@/modules/culinary/domain/repositories/culinary.repository';
import type { UsahaRepository } from '@/modules/usaha/domain/repositories/usaha.repository';
import type {
  CreateUsahaInput,
  UpdateUsahaInput,
} from '@/modules/usaha/domain/repositories/usaha.repository';
import {
  UniqueCulinarySlugUseCase,
  imagesToJson,
  slugifyUsaha,
} from '@/modules/culinary/application/use-cases/culinary.use-cases';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { composeCulinaryRejectDisplay } from '../domain/culinary-contribution.entity';
import type {
  ContributionImage,
  CuisineEditPayload,
  CulinaryContribution,
  CulinaryContributionKind,
  CulinaryContributionPayload,
  LinkPayload,
  NewCuisinePayload,
  NewUsahaPayload,
  UsahaEditPayload,
} from '../domain/culinary-contribution.entity';
import type { CulinaryContributionRepository } from '../domain/culinary-contribution.repository';
import type { ExplorationGroupNotifier } from '@/modules/wa/application/ports/exploration-group-notifier.port';

const PENDING_CAP = 10;
const MAX_IMAGES = 20;
/** Lisensi baku foto kuliner dari warga (PRD kuliner 13). */
const CC_BY_SA = 'CC BY-SA 4.0';

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

export const USAHA_EDIT_FIELDS = [
  'name',
  'description',
  'addressText',
  'lat',
  'lng',
  'mapsUrl',
  'phone',
  'whatsapp',
  'website',
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

function culinaryJenis(kind: CulinaryContributionKind): string {
  switch (kind) {
    case 'new_cuisine':
      return 'Kuliner';
    case 'new_usaha':
      return 'Usaha penjual kuliner';
    case 'cuisine_edit':
      return 'Kuliner (perbaikan)';
    case 'usaha_edit':
      return 'Usaha penjual kuliner (perbaikan)';
    default:
      return 'Kuliner (perbaikan)';
  }
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
  kind: 'new_cuisine' | 'new_usaha';
  payload: NewCuisinePayload | NewUsahaPayload;
}

export interface SubmitCulinaryChangeInput {
  kind: Exclude<CulinaryContributionKind, 'new_cuisine' | 'new_usaha'>;
  cuisineId?: string | null;
  usahaId?: string | null;
  linkId?: string | null;
  payload: CulinaryContributionPayload;
  /** Field yang diajukan (kind=*_edit). Kosong = deteksi dari payload. */
  fields?: string[];
}

export class CulinaryContributionUseCases {
  constructor(
    private readonly contrib: CulinaryContributionRepository,
    private readonly culinary: CulinaryRepository,
    private readonly usahas: UsahaRepository,
    private readonly uniqueCuisineSlug: UniqueCulinarySlugUseCase,
    private readonly audit?: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly activityEvents?: Pick<ActivityEventRepository, 'append'>,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  private async notifyGroup(
    userId: string,
    jenis: string,
    name: string | undefined,
    resubmit = false,
  ): Promise<void> {
    try {
      await this.groupNotifier?.notify({
        jenis,
        name: name?.trim() || 'tanpa nama',
        userId,
        resubmit,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan usulan.
    }
  }

  // ------------------------------------------------------------- publik --

  /** Usulan kuliner/tempat baru. Anonim diizinkan (rate limit di route). */
  async submit(
    userId: string,
    input: SubmitNewCulinaryInput,
  ): Promise<CulinaryContribution> {
    if (input.kind === 'new_cuisine') {
      await this.assertNewCuisine(input.payload as NewCuisinePayload);
    } else {
      this.assertNewUsaha(input.payload as NewUsahaPayload);
    }
    const anon = userId === ANONIM_USER_ID;
    if (!anon && (await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Maksimal 10 usulan yang masih menunggu',
      );
    }
    const created = await this.contrib.create({
      kind: input.kind,
      userId,
      lockedFields: '',
      payload: this.withDefaultLicense(input.payload),
    });
    await this.notifyGroup(
      userId,
      culinaryJenis(input.kind),
      (input.payload as { name?: string }).name,
    );
    return created;
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
      this.assertNewUsaha(input.payload as NewUsahaPayload);
    }
    await this.contrib.replacePayload(id, this.withDefaultLicense(input.payload), '');
    const updated = await this.contrib.findById(id);
    if (!updated) throw new Error('resubmit gagal - row hilang');
    await this.notifyGroup(
      userId,
      culinaryJenis(input.kind),
      (input.payload as { name?: string }).name,
      true,
    );
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

    if (input.kind === 'usaha_edit') {
      const usaha = await this.mustUsaha(input.usahaId);
      this.assertUsahaEdit(payload as UsahaEditPayload, locked);
      if (locked) {
        const pending = await this.contrib.pendingLockedFieldsForUsaha(usaha.id);
        if (pending.some((other) => overlaps(locked, other))) {
          throw new ConflictError(
            'PENDING_FIELD_LOCK',
            'Ada pengajuan lain yang sedang meninjau bagian yang sama. Tunggu keputusannya dulu ya.',
          );
        }
      }
      return this.createChange(userId, input, locked, usaha.createdAt, {
        usahaId: usaha.id,
        updatedAt: usaha.updatedAt,
      });
    }

    if (input.kind === 'link') {
      const p = payload as LinkPayload;
      if (!p.cuisineSlug?.trim() || !p.usahaSlug?.trim()) {
        throw new BadRequestError(
          'LINK_TARGET_REQUIRED',
          'Kuliner dan usaha wajib dipilih',
          [
            { field: 'cuisine_slug', message: 'Pilih kuliner dulu ya' },
            { field: 'usaha_slug', message: 'Pilih usaha dulu ya' },
          ],
        );
      }
      const cuisine = await this.culinary.findCuisineBySlug(p.cuisineSlug, {
        publicOnly: true,
      });
      if (!cuisine) {
        throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      }
      const usaha = await this.usahas.findBySlug(p.usahaSlug);
      if (!usaha) {
        throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
      }
      const existing = await this.culinary.findLinkByPair(cuisine.id, usaha.id);
      if (existing) {
        throw new ConflictError(
          'LINK_EXISTS',
          'Hubungan kuliner dan usaha ini sudah ada',
        );
      }
      return this.contrib.create({
        kind: 'link',
        userId,
        cuisineId: cuisine.id,
        usahaId: usaha.id,
        lockedFields: `link:${cuisine.id}:${usaha.id}`,
        payload: { ...p, cuisineSlug: cuisine.slug, usahaSlug: usaha.slug },
        baseUpdatedAt: usaha.updatedAt ?? usaha.createdAt,
      });
    }

    if (input.kind === 'usaha_operational') {
      const usaha = await this.mustUsaha(input.usahaId);
      const status = (payload as { operationalStatus?: string }).operationalStatus;
      if (!status) {
        throw new BadRequestError(
          'OPERATIONAL_STATUS_REQUIRED',
          'Status operasional wajib diisi',
        );
      }
      const pending = await this.contrib.pendingLockedFieldsForUsaha(usaha.id);
      if (pending.some((other) => overlaps('operationalStatus', other))) {
        throw new ConflictError(
          'PENDING_FIELD_LOCK',
          'Status operasional usaha ini sedang ditinjau. Tunggu keputusannya dulu ya.',
        );
      }
      return this.contrib.create({
        kind: 'usaha_operational',
        userId,
        usahaId: usaha.id,
        lockedFields: 'operationalStatus',
        payload,
        baseUpdatedAt: usaha.updatedAt ?? usaha.createdAt,
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
        usahaId: link.usahaId,
        linkId: link.id,
        lockedFields: `link:${link.cuisineId}:${link.usahaId}`,
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
      const usaha = await this.mustUsaha(input.usahaId);
      return this.contrib.create({
        kind: input.kind,
        userId,
        usahaId: usaha.id,
        lockedFields: 'publishStatus',
        payload,
        baseUpdatedAt: usaha.updatedAt ?? usaha.createdAt,
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
    override?: { images?: ContributionImage[] },
  ): Promise<void> {
    const row = await this.mustPending(id);
    // Admin boleh hapus/ganti foto usulan sebelum tayang (PRD kuliner).
    if (override?.images !== undefined) {
      const images = this.normalizeImageAttribution(override.images);
      this.assertImageAttribution(images);
      const payload =
        row.kind === 'new_cuisine'
          ? ({ ...row.payload, images } as NewCuisinePayload)
          : row.kind === 'cuisine_edit'
            ? ({ ...row.payload, images } as CuisineEditPayload)
            : row.payload;
      await this.contrib.replacePayload(id, payload, row.lockedFields);
      row.payload = payload;
    }

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

    if (row.kind === 'new_usaha') {
      const p = row.payload as NewUsahaPayload;
      const slug = await this.uniqueUsahaSlug(p.name);
      const usaha = await this.usahas.create({
        slug,
        name: p.name,
        description: p.description ?? null,
        addressText: p.addressText ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        mapsUrl: p.mapsUrl ?? null,
        phone: p.phone ?? null,
        whatsapp: p.whatsapp ?? null,
        website: p.website ?? null,
        coverUrl: p.coverUrl ?? null,
        publishStatus: 'published',
        authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
      } satisfies CreateUsahaInput);
      await this.contrib.setStatus(id, 'approved', { resultUsahaId: usaha.id });
      await this.emitPublished('usaha', usaha.id, usaha.name, row.userId);
      await this.audit?.record({
        userId: actorId ?? null,
        action: 'culinary.contribution.approve',
        entityType: 'usaha',
        entityId: usaha.id,
        newData: { kind: 'new_usaha', contribution_id: id, name: p.name },
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
      case 'usaha_edit': {
        const p = row.payload as UsahaEditPayload;
        const fields = row.lockedFields ? row.lockedFields.split(',') : [];
        const patch: UpdateUsahaInput = { id: row.usahaId! };
        for (const f of fields) {
          if (f in p) {
            (patch as unknown as Record<string, unknown>)[f] = (
              p as Record<string, unknown>
            )[f];
          }
        }
        await this.usahas.update(patch);
        break;
      }
      case 'link': {
        const p = row.payload as LinkPayload;
        if (row.cuisineId && row.usahaId) {
          await this.culinary.createLink({
            cuisineId: row.cuisineId,
            usahaId: row.usahaId,
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
      case 'usaha_operational': {
        const status = (row.payload as { operationalStatus: string })
          .operationalStatus;
        // Dimensi terpisah: publish_status TIDAK berubah (PRD 9).
        await this.usahas.update({
          id: row.usahaId!,
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
        } else if (row.usahaId) {
          await this.usahas.update({
            id: row.usahaId,
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
        } else if (row.usahaId) {
          await this.usahas.update({
            id: row.usahaId,
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
      entityType: row.cuisineId ? 'cuisine' : 'usaha',
      entityId: row.cuisineId ?? row.usahaId ?? id,
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
      entityType: row.cuisineId ? 'cuisine' : 'usaha',
      entityId: row.cuisineId ?? row.usahaId ?? id,
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
      entityType: row.cuisineId ? 'cuisine' : 'usaha',
      entityId: row.cuisineId ?? row.usahaId ?? id,
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
    target: { cuisineId?: string; usahaId?: string; updatedAt: Date | null },
  ): Promise<CulinaryContribution> {
    const created = await this.contrib.create({
      kind: input.kind,
      userId,
      cuisineId: target.cuisineId ?? null,
      usahaId: target.usahaId ?? null,
      lockedFields: locked,
      payload: this.withDefaultLicense(input.payload),
      baseUpdatedAt: target.updatedAt ?? _createdAt,
    });
    await this.notifyGroup(
      userId,
      culinaryJenis(input.kind),
      (input.payload as { name?: string }).name,
    );
    return created;
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
      case 'usaha_edit': {
        const p = input.payload as Record<string, unknown>;
        const declared = input.fields?.length
          ? input.fields
          : USAHA_EDIT_FIELDS.filter((f) => f in p);
        const unknown = declared.filter(
          (f) => !(USAHA_EDIT_FIELDS as readonly string[]).includes(f),
        );
        if (unknown.length > 0) {
          throw new BadRequestError(
            'UNKNOWN_FIELD',
            `Field tidak bisa diajukan: ${unknown.join(', ')}`,
          );
        }
        return canonicalCulinaryFields(declared);
      }
      case 'usaha_operational':
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

  /** Slug unik usaha penjual kuliner (pola UniqueCulinarySlugUseCase). */
  private async uniqueUsahaSlug(name: string): Promise<string> {
    const base = slugifyUsaha(name) || 'usaha';
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.usahas.existingSlugs(candidates);
    for (const slug of candidates) {
      if (!taken.has(slug)) return slug;
    }
    return `${base}-${Date.now()}`;
  }
  private assertNewUsaha(p: NewUsahaPayload): void {
    if (!p.name?.trim() || p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama usaha minimal 2 karakter',
        [{ field: 'name', message: 'Tulis nama usaha dulu ya' }],
      );
    }
    if ((p.lat != null) !== (p.lng != null)) {
      throw new BadRequestError(
        'LATLNG_PAIR',
        'Latitude dan longitude harus diisi berpasangan',
      );
    }
  }

  /**
   * Foto yang diunggah warga otomatis berlisensi CC BY-SA 4.0 (PRD kuliner).
   * Nama pemilik tetap wajib - dari akun pengunggah di mobile, atau diisi
   * admin untuk unggahan console. Lisensi yang kosong diisi default.
   */
  private normalizeImageAttribution(
    images: ContributionImage[] | undefined,
  ): ContributionImage[] | undefined {
    if (!images?.length) return images;
    return images.map((img) => ({
      ...img,
      attribution: img.attribution?.name
        ? { ...img.attribution, license: img.attribution.license || CC_BY_SA }
        : img.attribution,
    }));
  }

  /** Isi lisensi kosong dengan CC BY-SA 4.0 pada payload berisi gambar. */
  private withDefaultLicense(
    payload: CulinaryContributionPayload,
  ): CulinaryContributionPayload {
    if (!('images' in payload) || !payload.images?.length) return payload;
    return {
      ...payload,
      images: this.normalizeImageAttribution(payload.images),
    } as CulinaryContributionPayload;
  }

  private assertImageAttribution(
    images: NewCuisinePayload['images'] | undefined,
  ): void {
    for (const img of images ?? []) {
      if (!img.attribution?.name) {
        throw new BadRequestError(
          'ATTRIBUTION_REQUIRED',
          'Setiap gambar wajib punya sumber (nama pemilik)',
          [
            {
              field: 'images',
              message: 'Lengkapi nama pemilik gambar',
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

  private assertUsahaEdit(p: UsahaEditPayload, locked: string): void {
    if (!locked) {
      throw new BadRequestError(
        'EMPTY_CHANGE',
        'Tidak ada perubahan yang diajukan',
      );
    }
    if (p.name !== undefined && p.name.trim().length < 2) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama usaha minimal 2 karakter',
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

  private async mustUsaha(usahaId: string | null | undefined) {
    if (!usahaId) {
      throw new BadRequestError('USAHA_REQUIRED', 'Usaha wajib dipilih');
    }
    const usaha = await this.usahas.findById(usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return usaha;
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
      : row.usahaId
        ? await this.usahas.findById(row.usahaId)
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
      (row.cuisineId ? 'perubahan kuliner' : 'perubahan usaha')
    );
  }

  /** Activity event publik (AGENTS.md #25) - best-effort. */
  private async emitPublished(
    entity: 'cuisine' | 'usaha',
    id: string,
    name: string,
    authorId: string,
    dedupeSuffix?: string,
  ): Promise<void> {
    // Satu kind untuk modul kuliner (kuliner & usaha penjualnya): targetId
    // membedakan entitas, body membedakan jenis. `usaha_published` sudah
    // dipakai modul usaha (AGENTS.md #25) - jangan ditumpuk.
    const body =
      entity === 'cuisine'
        ? `Menambahkan kuliner · "${name}"`
        : `Menambahkan penjual kuliner · "${name}"`;
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
