/** Id slug di tabel `place_categories`. */
export type PlaceCategory = string;
export type PlaceType =
  | "sejarah"
  | "alam"
  | "religi"
  | "tirta"
  | "agro"
  | "bahari"
  | "budaya";
export type PlaceStatus = "draft" | "published" | "archived";

export interface PlaceSource {
  name: string;
  type: string;
  address: string;
  license?: string | null;
  licenseUrl?: string | null;
}

export type PlaceRelationKind = "place" | "usaha";

export interface PlaceRelation {
  kind: PlaceRelationKind;
  slug: string;
}

/** Kartu "Didekat sini". Usaha belum punya nama sampai modulnya ada. */
export interface PlaceRelatedCard {
  kind: PlaceRelationKind;
  slug: string;
  name: string | null;
  category: string | null;
  type: string | null;
  coverUrl: string | null;
}

export interface PlaceImageAttribution {
  name: string;
  provider?: string;
  url?: string | null;
  license?: string | null;
  licenseUrl?: string | null;
  source?: string | null;
  authorId?: string | null;
}

export interface PlaceImage {
  id: string;
  url: string;
  isMain: boolean;
  sortOrder: number;
  attribution: PlaceImageAttribution | null;
}

/** Pengusul live (JOIN users). Null = anonim / akun hilang. */
export interface PlaceAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

export interface Place {
  id: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  type: PlaceType | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  shortDescription: string;
  regionId: string | null;
  /** ULID desa di `regions`. Null kalau place masih di level kecamatan. */
  villageId: string | null;
  hours: string | null;
  contact: string | null;
  authorId: string | null;
  /** Diisi di path detail publik; list boleh null. */
  author: PlaceAuthorRef | null;
  sources: PlaceSource[];
  related: PlaceRelation[];
  images: PlaceImage[];
  status: PlaceStatus;
  createdAt: Date;
  updatedAt: Date | null;
}
