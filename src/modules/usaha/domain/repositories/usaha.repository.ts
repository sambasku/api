import type {
  UsahaKind,
  UsahaOperationalStatus,
  UsahaPublishStatus,
} from '@/shared/database/drizzle/schema/usahas.schema';
import type {
  UsahaDetail,
  UsahaListItem,
} from '../entities/usaha.entity';

export interface CreateUsahaInput {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  kind?: UsahaKind;
  regionId?: string | null;
  villageId?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  publishStatus?: UsahaPublishStatus;
  operationalStatus?: UsahaOperationalStatus;
  authorId?: string | null;
  items?: Array<{
    name: string;
    description?: string | null;
    priceText?: string | null;
    imageUrl?: string | null;
  }>;
}

export interface UpdateUsahaInput {
  id: string;
  slug?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  kind?: UsahaKind;
  regionId?: string | null;
  villageId?: string | null;
  addressText?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  coverUrl?: string | null;
  publishStatus?: UsahaPublishStatus;
  operationalStatus?: UsahaOperationalStatus;
  /** null = lepas pembatasan. */
  restricted?: { reason: string } | null;
}

export interface ListUsahasInput {
  limit: number;
  before?: string;
  categoryId?: string;
  regionId?: string;
  villageId?: string;
  kind?: UsahaKind;
  operationalStatus?: UsahaOperationalStatus;
  q?: string;
  status?: UsahaPublishStatus;
  /** true = hanya published + tidak dihapus (API publik). */
  publicOnly?: boolean;
  /** Hanya usaha yang dikelola user ini (Usaha Saya). */
  managerId?: string;
}

export interface ListUsahasResult {
  items: UsahaListItem[];
  nextCursor: string | null;
}

export interface UsahaRepository {
  create(input: CreateUsahaInput): Promise<UsahaListItem>;
  update(input: UpdateUsahaInput): Promise<UsahaListItem | null>;
  softDelete(id: string): Promise<boolean>;
  findById(id: string): Promise<UsahaDetail | null>;
  findBySlug(
    slug: string,
    opts?: { publicOnly?: boolean },
  ): Promise<UsahaDetail | null>;
  list(input: ListUsahasInput): Promise<ListUsahasResult>;
  /** Katalog item aktif usaha (satu query). */
  itemsOf(usahaId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      priceText: string | null;
      imageUrl: string | null;
      sortOrder: number;
    }>
  >;
  insertItem(
    usahaId: string,
    item: {
      name: string;
      description?: string | null;
      priceText?: string | null;
      imageUrl?: string | null;
    },
  ): Promise<string>;
  updateItem(
    itemId: string,
    item: {
      name?: string;
      description?: string | null;
      priceText?: string | null;
      imageUrl?: string | null;
    },
  ): Promise<boolean>;
  softDeleteItem(itemId: string): Promise<boolean>;
  /** Ref kategori untuk display (dipakai validator + serializer). */
  categoryRef(categoryId: string): Promise<{ id: string; name: string } | null>;
  /**
   * Katalog kategori usaha. Satu query - form select + filter.
   */
  listCategories(
    publicOnly: boolean,
  ): Promise<Array<{ id: string; name: string }>>;
  /** Slug yang sudah dipakai di antara kandidat (1 query IN). */
  existingSlugs(slugs: string[]): Promise<Set<string>>;
  /** Kandidat duplikat (nama persis sama + belum dihapus). Read-only, tidak merge. */
  findDuplicates(input: {
    usahaId: string;
    name: string;
    phone?: string | null;
  }): Promise<
    Array<{
      id: string;
      slug: string;
      name: string;
      phone: string | null;
      managerId: string | null;
    }>
  >;
}
