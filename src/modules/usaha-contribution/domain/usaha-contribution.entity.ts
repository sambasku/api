import type {
  UsahaContributionKind,
  UsahaContributionStatus,
} from '@/shared/database/drizzle/schema/usaha-contributions.schema';
import type { UsahaKind, UsahaOperationalStatus } from '@/shared/database/drizzle/schema/usahas.schema';

export type { UsahaContributionKind, UsahaContributionStatus };

export interface UsahaItemPayload {
  name: string;
  description?: string | null;
  priceText?: string | null;
  imageUrl?: string | null;
}

/** Payload usulan usaha baru (kind=new). Minimum: name + regionId. */
export interface NewUsahaPayload {
  name: string;
  regionId: string;
  description?: string | null;
  categoryId?: string | null;
  kind?: UsahaKind;
  villageId?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  items?: UsahaItemPayload[];
}

/** Perubahan profil pengelola (kind=profile) - hanya field di `fields`. */
export interface ProfilePayload {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  kind?: UsahaKind;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  regionId?: string | null;
  villageId?: string | null;
}

/** Semua bentuk payload kontribusi (discriminator `kind`). */
export type UsahaContributionPayload =
  | NewUsahaPayload
  | ProfilePayload
  | UsahaItemPayload
  | { itemId: string; operationalStatus?: UsahaOperationalStatus }
  | { itemId: string }
  | { operationalStatus: UsahaOperationalStatus }
  | Record<string, never>;

export interface UsahaContribution {
  id: string;
  kind: UsahaContributionKind;
  userId: string;
  usahaId: string | null;
  itemId: string | null;
  lockedFields: string;
  payload: UsahaContributionPayload;
  baseUpdatedAt: Date | null;
  status: UsahaContributionStatus;
  wantsClaim: boolean;
  resultUsahaId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  reviewedAt: Date | null;
}

export interface UsahaContributionWithUsaha extends UsahaContribution {
  usahaName: string | null;
  usahaSlug: string | null;
}

export const USAHA_CONTRIBUTION_REJECT_DISPLAY: Record<string, string> = {
  duplicate: 'usaha serupa sudah ada',
  incomplete: 'informasi belum lengkap',
  invalid: 'data tidak valid',
  not_owner: 'bukan pengelola usaha ini',
  stale: 'data usaha sudah berubah, ajukan ulang',
  violation: 'melanggar ketentuan',
  other: 'alasan lain',
};

export function composeUsahaRejectDisplay(
  code: string,
  text?: string | null,
): string {
  const base = USAHA_CONTRIBUTION_REJECT_DISPLAY[code] ?? code;
  return text?.trim() ? `${base} - ${text.trim()}` : base;
}

/** Label status untuk UI. */
export const USAHA_CONTRIBUTION_STATUS_LABEL: Record<
  UsahaContributionStatus,
  string
> = {
  pending: 'Menunggu tinjauan',
  needs_revision: 'Perlu revisi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

/** Label jenis pengajuan untuk UI. */
export const USAHA_CONTRIBUTION_KIND_LABEL: Record<
  UsahaContributionKind,
  string
> = {
  new: 'Usulan usaha baru',
  profile: 'Perubahan profil',
  item_add: 'Tambah item katalog',
  item_edit: 'Ubah item katalog',
  item_delete: 'Hapus item katalog',
  operational: 'Status operasional',
  archive: 'Minta arsip',
  restore: 'Minta tayang lagi',
};
