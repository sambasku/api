import type {
  CulinaryContributionKind,
  CulinaryContributionStatus,
} from '@/shared/database/drizzle/schema/culinary-contributions.schema';
import type {
  CulinaryOperationalStatus,
  CulinaryPlaceType,
} from '@/shared/database/drizzle/schema/culinary-places.schema';
import type { CulinaryAvailability } from '@/shared/database/drizzle/schema/culinary-place-cuisines.schema';

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

/** Usulan tempat/penjual baru (kind=new_place). Minimum: name (PRD 7.2). */
export interface NewPlacePayload {
  name: string;
  type?: CulinaryPlaceType | null;
  description?: string | null;
  locationHint?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
}

/** Usulan hubungan kuliner-tempat (kind=link). PRD 7.3. */
export interface LinkPayload {
  cuisineSlug: string;
  placeSlug: string;
  availability?: CulinaryAvailability;
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

/** Perbaikan data tempat (kind=place_edit) - hanya field di `fields`. */
export interface PlaceEditPayload {
  name?: string;
  type?: CulinaryPlaceType | null;
  description?: string | null;
  locationHint?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
}

export interface OperationalPayload {
  operationalStatus: CulinaryOperationalStatus;
}

export interface ArchivePayload {
  reason?: string | null;
}

/** Semua bentuk payload kontribusi kuliner (discriminator `kind`). */
export type CulinaryContributionPayload =
  | NewCuisinePayload
  | NewPlacePayload
  | LinkPayload
  | CuisineEditPayload
  | PlaceEditPayload
  | OperationalPayload
  | ArchivePayload;

export interface CulinaryContribution {
  id: string;
  kind: CulinaryContributionKind;
  userId: string;
  cuisineId: string | null;
  placeId: string | null;
  linkId: string | null;
  lockedFields: string;
  payload: CulinaryContributionPayload;
  baseUpdatedAt: Date | null;
  status: CulinaryContributionStatus;
  resultCuisineId: string | null;
  resultPlaceId: string | null;
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
  placeName: string | null;
  placeSlug: string | null;
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
  new_place: 'Usulan tempat baru',
  link: 'Usulan hubungan kuliner-tempat',
  cuisine_edit: 'Perbaikan data kuliner',
  place_edit: 'Perbaikan data tempat',
  link_edit: 'Ubah ketersediaan relasi',
  place_operational: 'Status operasional tempat',
  archive: 'Minta arsip',
  restore: 'Minta tayang lagi',
};
