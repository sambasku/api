import type {
  UsahaKind,
  UsahaOperationalStatus,
  UsahaPublishStatus,
} from '@/shared/database/drizzle/schema/usahas.schema';

/** Id slug di tabel `usaha_categories`. */
export type UsahaCategory = string;

export interface UsahaCategoryRef {
  id: string;
  name: string;
}

export interface UsahaVillageRef {
  id: string;
  name: string;
  slug: string | null;
}

/** Kecamatan (region_id) - bentuk sama desa. */
export interface UsahaRegionRef {
  id: string;
  name: string;
  slug: string | null;
}

/** Pengusul live (JOIN users) - untuk apresiasi di detail. */
export interface UsahaAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

export interface UsahaItem {
  id: string;
  name: string;
  description: string | null;
  /** Teks bebas. Kosong = belum dicantumkan (bukan gratis). */
  priceText: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface Usaha {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: UsahaCategory | null;
  kind: UsahaKind;
  regionId: string | null;
  villageId: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  /** Kontak PUBLIK - terpisah dari bukti klaim. */
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  socialUrl: string | null;
  coverUrl: string | null;
  publishStatus: UsahaPublishStatus;
  operationalStatus: UsahaOperationalStatus;
  restrictedReason: string | null;
  restrictedAt: Date | null;
  managerId: string | null;
  authorId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UsahaListItem extends Usaha {
  category: UsahaCategoryRef | null;
  region: UsahaRegionRef | null;
  village: UsahaVillageRef | null;
  author: UsahaAuthorRef | null;
  /** Pengelola terverifikasi (klaim disetujui admin), JOIN users. */
  manager: UsahaAuthorRef | null;
}

/** Detail + katalog versi publik. */
export interface UsahaDetail extends UsahaListItem {
  items: UsahaItem[];
  /** Foto singgah (halaman pertama / ringkas). Opsional di list. */
  images?: UsahaImage[];
}

export interface UsahaImageAttribution {
  name: string;
  provider: string;
  authorId?: string | null;
  username?: string | null;
}

export interface UsahaImage {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
  attribution: UsahaImageAttribution | null;
}

export interface UsahaImageInput {
  url: string;
  isMain?: boolean;
  attribution?: UsahaImageAttribution | null;
}
