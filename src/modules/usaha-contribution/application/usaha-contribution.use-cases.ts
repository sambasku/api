import type { RegionRepository } from '@/modules/region/domain/repositories/region.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { InboxNotificationType } from '@/modules/notification/domain/entities/notification.entity';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { ActivityEventRepository } from '@/modules/activity/domain/repositories/activity-event.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UsahaClaimRepository } from '@/modules/usaha-claim/domain/usaha-claim.repository';
import {
  CreateUsahaUseCase,
  UniqueUsahaSlugUseCase,
} from '@/modules/usaha/application/use-cases/usaha.use-cases';
import type { UsahaRepository } from '@/modules/usaha/domain/repositories/usaha.repository';
import type { UpdateUsahaInput } from '@/modules/usaha/domain/repositories/usaha.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { composeUsahaRejectDisplay } from '../domain/usaha-contribution.entity';
import type {
  NewUsahaPayload,
  ProfilePayload,
  UsahaContribution,
  UsahaContributionKind,
  UsahaContributionPayload,
} from '../domain/usaha-contribution.entity';
import type { UsahaContributionRepository } from '../domain/usaha-contribution.repository';

const PENDING_CAP = 10;
const MAX_ITEMS = 20;

/**
 * Field yang boleh diajukan pengelola lewat kind=profile. Daftar ini juga
 * jadi dasar field-lock (PRD 10.1): dua pengajuan pending bersamaan hanya
 * boleh menyentuh bidang berbeda.
 */
export const PROFILE_MANAGED_FIELDS = [
  'name',
  'description',
  'categoryId',
  'kind',
  'addressText',
  'lat',
  'lng',
  'phone',
  'whatsapp',
  'website',
  'socialUrl',
  'coverUrl',
  'regionId',
  'villageId',
] as const;

/** Kanonik ter-sort: dasar pembanding overlap field-lock. */
export function canonicalFields(fields: string[]): string {
  return [...new Set(fields)].sort().join(',');
}

function overlaps(a: string, b: string): boolean {
  if (!a || !b) return false;
  const setB = new Set(b.split(','));
  return a.split(',').some((f) => setB.has(f));
}

/** Copy notifikasi inbox + FCM untuk keputusan pengajuan usaha. */
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
      title: 'Pengajuan usaha disetujui',
      body: `Pengajuanmu "${label}" sudah diterapkan. Terima kasih!`,
    };
  }
  if (kind === 'needs_revision') {
    const note = opts?.revisionNote ? ` Catatan: ${opts.revisionNote}.` : '';
    return {
      title: 'Pengajuan usaha perlu revisi',
      body: `Pengajuanmu "${label}" perlu diperbaiki dulu.${note} Buka daftar usulan untuk detailnya.`,
    };
  }
  const reason = opts?.rejectReason
    ? ` Alasan: ${composeUsahaRejectDisplay(opts.rejectReason.code, opts.rejectReason.text)}.`
    : '';
  return {
    title: 'Pengajuan usaha ditolak',
    body: `Pengajuanmu "${label}" ditolak.${reason} Buka daftar usulan untuk detailnya.`,
  };
}

export interface SubmitNewUsahaInput {
  payload: NewUsahaPayload;
  wantsClaim: boolean;
}

export interface SubmitManagerChangeInput {
  kind: Exclude<UsahaContributionKind, 'new'>;
  usahaId: string;
  itemId?: string | null;
  payload: UsahaContributionPayload;
  /** Field yang diajukan (kind=profile). Kosong = payload yang dikirim. */
  fields?: string[];
}

export class UsahaContributionUseCases {
  constructor(
    private readonly contrib: UsahaContributionRepository,
    private readonly usahas: UsahaRepository,
    private readonly regions: RegionRepository,
    private readonly createUsaha: CreateUsahaUseCase,
    private readonly uniqueSlug: UniqueUsahaSlugUseCase,
    private readonly claims: UsahaClaimRepository,
    private readonly audit?: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly activityEvents?: Pick<ActivityEventRepository, 'append'>,
  ) {}

  // ------------------------------------------------------------- publik --

  /** Usulan usaha baru. Anon diizinkan (rate limit di route per IP). */
  async submit(
    userId: string,
    input: SubmitNewUsahaInput,
  ): Promise<UsahaContribution> {
    const payload = await this.assertNewPayload(input.payload);
    const anon = userId === ANONIM_USER_ID;
    if (!anon && (await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Maksimal 10 usulan yang masih menunggu',
      );
    }
    return this.contrib.create({
      kind: 'new',
      userId,
      lockedFields: '',
      payload,
      // Anonim tidak bisa mengklaim (tidak ada akun penerima).
      wantsClaim: input.wantsClaim && !anon,
    });
  }

  mine(userId: string) {
    return this.contrib.listByUser(userId);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError(
        'CONTRIBUTION_NOT_FOUND',
        'Usulan tidak ditemukan',
      );
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
    input: SubmitNewUsahaInput,
  ): Promise<UsahaContribution> {
    const row = await this.contrib.findById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError(
        'CONTRIBUTION_NOT_FOUND',
        'Usulan tidak ditemukan',
      );
    }
    if (row.kind !== 'new') {
      throw new ConflictError(
        'NOT_NEW_PROPOSAL',
        'Hanya usulan usaha baru yang bisa dikirim ulang dari sini',
      );
    }
    if (row.status !== 'needs_revision') {
      throw new ConflictError(
        'NOT_NEEDS_REVISION',
        'Usulan ini tidak menunggu revisi',
      );
    }
    const payload = await this.assertNewPayload(input.payload);
    await this.contrib.replacePayload(id, payload, '');
    const updated = await this.contrib.findById(id);
    if (!updated) throw new Error('resubmit gagal - row hilang');
    return updated;
  }

  // ---------------------------------------------------------- pengelola --

  /**
   * Pengajuan pengelola (profil/katalog/operasional/arsip). Field-lock:
   * tolak bila bidang yang diajukan beririsan pengajuan pending lain
   * untuk usaha yang sama (PRD 10.1).
   */
  async submitManagerChange(
    userId: string,
    input: SubmitManagerChangeInput,
  ): Promise<UsahaContribution> {
    const usaha = await this.usahas.findById(input.usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    if (usaha.managerId !== userId) {
      throw new ForbiddenError(
        'NOT_MANAGER',
        'Hanya pengelola terverifikasi yang bisa mengusulkan perubahan',
      );
    }
    if (usaha.publishStatus === 'restricted') {
      throw new ForbiddenError(
        'USAHA_RESTRICTED',
        'Usaha ini sedang dibatasi admin',
      );
    }
    if ((await this.contrib.countPending(userId)) >= PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Maksimal 10 pengajuan yang masih menunggu',
      );
    }

    const locked = this.lockedFieldsFor(input);
    let payload = input.payload;
    if (input.kind === 'profile') {
      payload = await this.assertProfilePayload(
        input.payload as ProfilePayload,
        locked,
      );
    }
    if (
      input.kind === 'item_add' ||
      input.kind === 'item_edit' ||
      input.kind === 'item_delete'
    ) {
      await this.assertItemChange(input, usaha.id);
    }
    if (input.kind === 'operational') {
      const status = (input.payload as { operationalStatus?: string })
        .operationalStatus;
      if (!status) {
        throw new BadRequestError(
          'OPERATIONAL_STATUS_REQUIRED',
          'Status operasional wajib diisi',
        );
      }
    }

    if (locked && usaha.id) {
      const pending = await this.contrib.pendingLockedFields(usaha.id);
      if (pending.some((other) => overlaps(locked, other))) {
        throw new ConflictError(
          'PENDING_FIELD_LOCK',
          'Ada pengajuan lain yang sedang meninjau bagian yang sama. Tunggu keputusannya dulu ya.',
        );
      }
    }

    return this.contrib.create({
      kind: input.kind,
      userId,
      usahaId: usaha.id,
      itemId: input.itemId ?? null,
      lockedFields: locked,
      payload,
      baseUpdatedAt: usaha.updatedAt ?? usaha.createdAt,
    });
  }

  // ------------------------------------------------------------- admin --

  list(filter: { status?: 'pending' | 'needs_revision' | 'approved' | 'rejected'; kind?: UsahaContributionKind }) {
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

    if (row.kind === 'new') {
      const p = row.payload as NewUsahaPayload;
      const slug = await this.uniqueSlug.execute(p.name);
      const usaha = await this.createUsaha.execute({
        slug,
        name: p.name,
        description: p.description ?? null,
        categoryId: p.categoryId ?? null,
        kind: p.kind,
        regionId: p.regionId,
        villageId: p.villageId ?? null,
        addressText: p.addressText ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        phone: p.phone ?? null,
        whatsapp: p.whatsapp ?? null,
        website: p.website ?? null,
        socialUrl: p.socialUrl ?? null,
        coverUrl: p.coverUrl ?? null,
        publishStatus: 'published',
        authorId: row.userId === ANONIM_USER_ID ? null : row.userId,
        items: p.items?.map((it) => ({
          name: it.name,
          description: it.description ?? null,
          priceText: it.priceText ?? null,
          imageUrl: it.imageUrl ?? null,
        })),
      });
      await this.contrib.setStatus(id, 'approved', { resultUsahaId: usaha.id });

      // "Ini usaha saya" -> klaim pending untuk admin tinjau (anon skip).
      if (row.wantsClaim && row.userId !== ANONIM_USER_ID) {
        const existing = await this.claims.findPendingByUser(
          usaha.id,
          row.userId,
        );
        if (!existing) {
          await this.claims.create({
            usahaId: usaha.id,
            userId: row.userId,
            contactEvidence: `Diajukan lewat usulan usaha "${p.name}"`,
            note: 'Klaim otomatis dari usulan usaha baru (menandai "ini usaha saya")',
          });
        }
      }

      await this.emitPublished(usaha.id, usaha.slug, usaha.name, row.userId);
      await this.audit?.record({
        userId: actorId ?? null,
        action: 'usaha.contribution.approve',
        entityType: 'usaha',
        entityId: usaha.id,
        newData: { kind: 'new', contribution_id: id, name: p.name },
        requestId: requestId ?? null,
      });
      await this.notifyDecision(row, 'approved', undefined, actorId);
      return;
    }

    const usaha = await this.mustUsaha(row);
    if (
      row.baseUpdatedAt &&
      usaha.updatedAt &&
      usaha.updatedAt.getTime() > row.baseUpdatedAt.getTime()
    ) {
      throw new ConflictError(
        'STALE_DATA',
        'Data usaha sudah berubah sejak pengajuan dibuat. Minta pengelola mengajukan ulang.',
      );
    }

    switch (row.kind) {
      case 'profile': {
        const p = row.payload as ProfilePayload;
        const fields = row.lockedFields ? row.lockedFields.split(',') : [];
        const patch: Record<string, unknown> = { id: usaha.id };
        for (const f of fields) {
          if (f in p) patch[f] = (p as Record<string, unknown>)[f];
        }
        await this.usahas.update(patch as unknown as UpdateUsahaInput);
        break;
      }
      case 'item_add': {
        const p = row.payload as { name: string };
        await this.usahas.insertItem(usaha.id, {
          name: p.name,
          description: (p as { description?: string | null }).description ?? null,
          priceText: (p as { priceText?: string | null }).priceText ?? null,
          imageUrl: (p as { imageUrl?: string | null }).imageUrl ?? null,
        });
        break;
      }
      case 'item_edit': {
        if (!row.itemId) {
          throw new BadRequestError('ITEM_REQUIRED', 'Item katalog wajib diisi');
        }
        const ok = await this.usahas.updateItem(row.itemId, {
          ...(row.payload as Record<string, unknown>),
        } as Parameters<UsahaRepository['updateItem']>[1]);
        if (!ok) {
          throw new NotFoundError('ITEM_NOT_FOUND', 'Item katalog tidak ditemukan');
        }
        break;
      }
      case 'item_delete': {
        if (!row.itemId) {
          throw new BadRequestError('ITEM_REQUIRED', 'Item katalog wajib diisi');
        }
        const ok = await this.usahas.softDeleteItem(row.itemId);
        if (!ok) {
          throw new NotFoundError('ITEM_NOT_FOUND', 'Item katalog tidak ditemukan');
        }
        break;
      }
      case 'operational': {
        const status = (row.payload as { operationalStatus: string })
          .operationalStatus;
        // Dimensi terpisah: publish_status TIDAK berubah (PRD 11).
        await this.usahas.update({
          id: usaha.id,
          operationalStatus: status as never,
        });
        break;
      }
      case 'archive':
        await this.usahas.update({ id: usaha.id, publishStatus: 'archived' });
        break;
      case 'restore':
        await this.usahas.update({ id: usaha.id, publishStatus: 'published' });
        break;
      default:
        break;
    }

    await this.contrib.setStatus(id, 'approved');
    await this.audit?.record({
      userId: actorId ?? null,
      action: 'usaha.contribution.approve',
      entityType: 'usaha',
      entityId: usaha.id,
      newData: { kind: row.kind, contribution_id: id },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(row, 'approved', undefined, actorId);
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
      action: 'usaha.contribution.reject',
      entityType: row.usahaId ? 'usaha' : 'usaha_contribution',
      entityId: row.usahaId ?? id,
      newData: { kind: row.kind, contribution_id: id, reason_code: reasonCode },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(
      row,
      'rejected',
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
      action: 'usaha.contribution.request_revision',
      entityType: row.usahaId ? 'usaha' : 'usaha_contribution',
      entityId: row.usahaId ?? id,
      newData: { kind: row.kind, contribution_id: id },
      requestId: requestId ?? null,
    });
    await this.notifyDecision(
      row,
      'needs_revision',
      { revisionNote: note },
      actorId,
    );
  }

  // ------------------------------------------------------------- private --

  private lockedFieldsFor(input: SubmitManagerChangeInput): string {
    switch (input.kind) {
      case 'profile': {
        const p = input.payload as Record<string, unknown>;
        const declared =
          input.fields?.length
            ? input.fields
            : PROFILE_MANAGED_FIELDS.filter((f) => f in p);
        const unknown = declared.filter(
          (f) => !(PROFILE_MANAGED_FIELDS as readonly string[]).includes(f),
        );
        if (unknown.length > 0) {
          throw new BadRequestError(
            'UNKNOWN_FIELD',
            `Field tidak bisa diajukan pengelola: ${unknown.join(', ')}`,
          );
        }
        return canonicalFields(declared);
      }
      case 'item_add':
        return 'items';
      case 'item_edit':
        return `item:${input.itemId ?? ''}`;
      case 'item_delete':
        return `item:${input.itemId ?? ''}`;
      case 'operational':
        return 'operationalStatus';
      case 'archive':
        return 'publishStatus';
      case 'restore':
        return 'publishStatus';
      default:
        return '';
    }
  }

  private async assertNewPayload(
    payload: NewUsahaPayload,
  ): Promise<NewUsahaPayload> {
    if (!payload.name?.trim() || payload.name.trim().length < 3) {
      throw new BadRequestError(
        'NAME_TOO_SHORT',
        'Nama usaha minimal 3 karakter',
      );
    }
    if (!payload.regionId) {
      throw new BadRequestError(
        'REGION_REQUIRED',
        'Wilayah (kecamatan) wajib diisi',
      );
    }
    if ((payload.lat != null) !== (payload.lng != null)) {
      throw new BadRequestError(
        'LATLNG_PAIR',
        'Latitude dan longitude harus diisi berpasangan',
      );
    }
    if ((payload.items?.length ?? 0) > MAX_ITEMS) {
      throw new BadRequestError(
        'TOO_MANY_ITEMS',
        `Maksimal ${MAX_ITEMS} item katalog per usulan`,
      );
    }
    if (payload.categoryId) {
      const category = await this.usahas.categoryRef(payload.categoryId);
      if (!category) {
        throw new BadRequestError(
          'CATEGORY_NOT_FOUND',
          'Kategori usaha tidak ditemukan',
        );
      }
    }
    return this.normalizeRegionRefs(payload);
  }

  /**
   * Klien (mobile) memilih wilayah dari katalog publik yang `id`-nya SLUG,
   * sedangkan kolom `region_id`/`village_id` menyimpan ULID. Resolusi di sini
   * supaya payload yang tersimpan selalu ULID dan perbandingan induk akurat.
   */
  private async normalizeRegionRefs<T extends NewUsahaPayload>(
    payload: T,
  ): Promise<T> {
    const region = await this.regions.findByIdOrSlug(payload.regionId);
    if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
      throw new BadRequestError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
    }
    const villageId = payload.villageId
      ? await this.resolveVillage(payload.villageId, region.id)
      : null;
    return { ...payload, regionId: region.id, villageId };
  }

  private async resolveVillage(
    ref: string,
    regionId: string | null,
  ): Promise<string> {
    const village = await this.regions.findByIdOrSlug(ref);
    if (!village || village.type !== 'desa' || village.status !== 'published') {
      throw new BadRequestError('VILLAGE_NOT_FOUND', 'Desa tidak ditemukan');
    }
    if (regionId && village.parentId !== regionId) {
      throw new BadRequestError(
        'VILLAGE_MISMATCH',
        'Desa bukan bagian dari kecamatan yang dipilih',
      );
    }
    return village.id;
  }

  private async assertProfilePayload(
    payload: ProfilePayload,
    locked: string,
  ): Promise<ProfilePayload> {
    const fields = locked ? locked.split(',') : [];
    if (fields.length === 0) {
      throw new BadRequestError(
        'EMPTY_CHANGE',
        'Tidak ada perubahan yang diajukan',
      );
    }
    if ((payload.lat != null) !== (payload.lng != null)) {
      throw new BadRequestError(
        'LATLNG_PAIR',
        'Latitude dan longitude harus diisi berpasangan',
      );
    }
    if (payload.categoryId) {
      const category = await this.usahas.categoryRef(payload.categoryId);
      if (!category) {
        throw new BadRequestError(
          'CATEGORY_NOT_FOUND',
          'Kategori usaha tidak ditemukan',
        );
      }
    }
    if (!payload.regionId) {
      return payload.villageId
        ? {
            ...payload,
            villageId: await this.resolveVillage(payload.villageId, null),
          }
        : payload;
    }
    const region = await this.regions.findByIdOrSlug(payload.regionId);
    if (!region || region.type !== 'kecamatan' || region.status !== 'published') {
      throw new BadRequestError('REGION_NOT_FOUND', 'Kecamatan tidak ditemukan');
    }
    return {
      ...payload,
      regionId: region.id,
      villageId: payload.villageId
        ? await this.resolveVillage(payload.villageId, region.id)
        : payload.villageId,
    };
  }

  private async assertItemChange(
    input: SubmitManagerChangeInput,
    usahaId: string,
  ): Promise<void> {
    if (input.kind === 'item_add') {
      const name = (input.payload as { name?: string }).name;
      if (!name?.trim()) {
        throw new BadRequestError('ITEM_NAME_REQUIRED', 'Nama item wajib diisi');
      }
      return;
    }
    if (!input.itemId) {
      throw new BadRequestError('ITEM_REQUIRED', 'Item katalog wajib dipilih');
    }
    const usaha = await this.usahas.findById(usahaId);
    const own = usaha?.items.some((it) => it.id === input.itemId);
    if (!own) {
      throw new ForbiddenError(
        'ITEM_NOT_OWNED',
        'Item katalog bukan milik usaha ini',
      );
    }
  }

  private async mustPending(id: string): Promise<UsahaContribution> {
    const row = await this.contrib.findById(id);
    if (!row) {
      throw new NotFoundError(
        'CONTRIBUTION_NOT_FOUND',
        'Pengajuan tidak ditemukan',
      );
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Pengajuan sudah ditinjau');
    }
    return row;
  }

  private async mustUsaha(row: UsahaContribution) {
    if (!row.usahaId) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    const usaha = await this.usahas.findById(row.usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return usaha;
  }

  /** Activity `usaha_published` (AGENTS.md #25) - best-effort. */
  private async emitPublished(
    usahaId: string,
    slug: string,
    name: string,
    authorId: string,
  ): Promise<void> {
    if (authorId === ANONIM_USER_ID) {
      // Anonim tidak punya identitas publik: tetap catat tanpa aktor supaya
      // feed punya jejak "usaha baru" tanpa membocorkan siapa pun.
      try {
        await this.activityEvents?.append({
          kind: 'usaha_published',
          actorId: null,
          targetId: usahaId,
          payload: `Menambahkan usaha · "${name}"`,
          dedupeKey: `usaha_published:${usahaId}`,
        });
      } catch {
        /* best-effort */
      }
      return;
    }
    try {
      await this.activityEvents?.append({
        kind: 'usaha_published',
        actorId: authorId,
        targetId: usahaId,
        payload: `Menambahkan usaha · "${name}"`,
        dedupeKey: `usaha_published:${usahaId}`,
      });
    } catch {
      /* best-effort */
    }
    void slug;
  }

  private async notifyDecision(
    row: UsahaContribution,
    kind: 'approved' | 'rejected' | 'needs_revision',
    opts?: {
      rejectReason?: { code: string; text?: string | null };
      revisionNote?: string | null;
    },
    actorId?: string,
  ): Promise<void> {
    if (!row.userId || row.userId === ANONIM_USER_ID) return;
    if (actorId && actorId === row.userId) return;
    const label =
      (row.payload as NewUsahaPayload).name ??
      (row.usahaId ? 'perubahan usaha' : 'usaha');
    const copy = decisionCopy(kind, label, opts);
    const type: InboxNotificationType =
      kind === 'approved'
        ? 'usaha_contribution_approved'
        : kind === 'rejected'
          ? 'usaha_contribution_rejected'
          : 'usaha_contribution_needs_revision';
    try {
      await this.inbox?.execute({
        userId: row.userId,
        type,
        targetKind: 'usaha_contribution',
        targetId: row.id,
        title: copy.title,
        body: copy.body,
        actionKind: 'usaha_contribution',
        actionValue: row.id,
        actorId,
      });
      await this.notifyUser?.execute({
        userId: row.userId,
        title: copy.title,
        body: copy.body,
        data: {
          type,
          target_kind: 'usaha_contribution',
          target_id: row.id,
        },
        actorId,
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'notifikasi keputusan pengajuan usaha gagal',
          contribution_id: row.id,
          kind,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
