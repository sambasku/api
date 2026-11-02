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
  village: UsahaVillageRef | null;
}

/** Detail + katalog versi publik. */
export interface UsahaDetail extends UsahaListItem {
  items: UsahaItem[];
}
