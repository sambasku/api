import type {
  CulinaryContributionKind,
  CulinaryContributionStatus,
} from '@/shared/database/drizzle/schema/culinary-contributions.schema';
import type { CuisineUsahaAvailability } from '@/shared/database/drizzle/schema/cuisine-usahas.schema';

export type { CulinaryContributionKind, CulinaryContributionStatus };

/** Atribusi gambar usulan (PRD kuliner 13 - wajib saat ada gambar). */
export interface ContributionImage {
  url: string;
  isMain?: boolean;
  attribution?: {
    name?: string;
    provider?: string;
    url?: string;
    license?: string;
    license_url?: string;
  } | null;
}

/** Usulan kuliner baru (kind=new_cuisine). Minimum: name (PRD 7.1). */
export interface NewCuisinePayload {
  name: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  images?: ContributionImage[];
  ingredients?: string[];
  servingSuggestion?: string | null;
  tags?: string[];
  sources?: Array<{
    name: string;
    type?: string;
    address: string;
    license?: string | null;
    licenseUrl?: string | null;
  }>;
}

/** Usulan usaha (penjual kuliner) baru (kind=new_usaha). Minimum: name. */
export interface NewUsahaPayload {
  name: string;
  description?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  coverUrl?: string | null;
}

/** Usulan hubungan kuliner-usaha (kind=link). PRD 7.3. */
export interface LinkPayload {
  cuisineSlug: string;
  usahaSlug: string;
  availability?: CuisineUsahaAvailability;
  note?: string | null;
}

/** Perbaikan data kuliner (kind=cuisine_edit) - hanya field di `fields`. */
export interface CuisineEditPayload {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  originRegion?: string | null;
  images?: ContributionImage[];
  ingredients?: string[];
  servingSuggestion?: string | null;
  tags?: string[];
  sources?: NewCuisinePayload['sources'];
}

/** Perbaikan data usaha penjual kuliner (kind=usaha_edit) - dialihkan ke
 * usulan usaha (usaha-contribution); payload ini hanya untuk edit ringan
 * lewat antrean kuliner. */
export interface UsahaEditPayload {
  name?: string;
  description?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  coverUrl?: string | null;
}

export interface OperationalPayload {
  operationalStatus: string;
}

export interface ArchivePayload {
  reason?: string | null;
}

/** Semua bentuk payload kontribusi kuliner (discriminator `kind`). */
export type CulinaryContributionPayload =
  | NewCuisinePayload
  | NewUsahaPayload
  | LinkPayload
  | CuisineEditPayload
  | UsahaEditPayload
  | OperationalPayload
  | ArchivePayload;

export interface CulinaryContribution {
  id: string;
  kind: CulinaryContributionKind;
  userId: string;
  cuisineId: string | null;
  usahaId: string | null;
  linkId: string | null;
  lockedFields: string;
  payload: CulinaryContributionPayload;
  baseUpdatedAt: Date | null;
  status: CulinaryContributionStatus;
  resultCuisineId: string | null;
  resultUsahaId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  reviewedAt: Date | null;
}

export interface CulinaryContributionWithTarget extends CulinaryContribution {
  cuisineName: string | null;
  cuisineSlug: string | null;
  usahaName: string | null;
  usahaSlug: string | null;
}

export const CULINARY_CONTRIBUTION_REJECT_DISPLAY: Record<string, string> = {
  duplicate: 'sudah ada yang mirip',
  incomplete: 'data belum lengkap',
  invalid: 'data tidak valid',
  unverifiable: 'belum bisa diverifikasi',
  attribution: 'atribusi gambar belum lengkap',
  violation: 'melanggar ketentuan',
  stale: 'data dasar sudah berubah',
  other: 'alasan lain',
};

export function composeCulinaryRejectDisplay(
  code: string,
  text?: string | null,
): string {
  const base = CULINARY_CONTRIBUTION_REJECT_DISPLAY[code] ?? code;
  return text?.trim() ? `${base} - ${text.trim()}` : base;
}

/** Label status untuk UI. */
export const CULINARY_CONTRIBUTION_STATUS_LABEL: Record<
  CulinaryContributionStatus,
  string
> = {
  pending: 'Menunggu tinjauan',
  needs_revision: 'Perlu revisi',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

/** Label jenis pengajuan untuk UI. */
export const CULINARY_CONTRIBUTION_KIND_LABEL: Record<
  CulinaryContributionKind,
  string
> = {
  new_cuisine: 'Usulan kuliner baru',
  new_usaha: 'Usulan usaha penjual kuliner baru',
  link: 'Usulan hubungan kuliner-usaha',
  cuisine_edit: 'Perbaikan data kuliner',
  usaha_edit: 'Perbaikan data usaha penjual kuliner',
  link_edit: 'Ubah ketersediaan relasi',
  usaha_operational: 'Status operasional usaha',
  archive: 'Minta arsip',
  restore: 'Minta tayang lagi',
};
