// Riwayat perubahan entitas eksplorasi (wisata, kuliner, usaha, acara, karya,
// layanan, komunitas).
//
// Sumber data: `audit_logs` (entity_type = salah satu ExploreEntityType, old_data/new_data
// = snapshot field PUBLIK yang berubah). Hanya field yang tampil di detail
// publik yang boleh masuk snapshot - jangan pernah isi dengan data privat.

export const EXPLORE_ENTITY_TYPES = [
  'place',
  'cuisine',
  'usaha',
  'event',
  'karya',
  'layanan',
  'community',
] as const;
export type ExploreEntityType = (typeof EXPLORE_ENTITY_TYPES)[number];

export type EntityChangeAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'takedown'
  | 'photo_add'
  | 'photo_remove';

type FieldKind = 'text' | 'status' | 'count' | 'opaque' | 'datetime';

interface FieldSpec {
  label: string;
  kind: FieldKind;
  /** Peta nilai mentah -> label tampil (enum). */
  values?: Record<string, string>;
  /** Satuan untuk kind 'count' (default 'foto'). */
  unit?: string;
}

export const ENTITY_FIELDS: Record<ExploreEntityType, Record<string, FieldSpec>> = {
  place: {
    name: { label: 'Nama', kind: 'text' },
    category: { label: 'Kategori', kind: 'text' },
    type: { label: 'Jenis', kind: 'text' },
    short_description: { label: 'Deskripsi singkat', kind: 'text' },
    hours: { label: 'Jam buka', kind: 'text' },
    contact: { label: 'Kontak', kind: 'text' },
    maps_url: { label: 'Tautan peta', kind: 'text' },
    coordinates: { label: 'Koordinat', kind: 'text' },
    area: { label: 'Wilayah', kind: 'opaque' },
    status: { label: 'Status', kind: 'status' },
    photo_count: { label: 'Jumlah foto', kind: 'count' },
  },
  cuisine: {
    name: { label: 'Nama', kind: 'text' },
    description: { label: 'Deskripsi', kind: 'text' },
    category: { label: 'Kategori', kind: 'text' },
    origin_region: { label: 'Daerah asal', kind: 'text' },
    ingredients: { label: 'Bahan', kind: 'text' },
    serving_suggestion: { label: 'Saran penyajian', kind: 'text' },
    tags: { label: 'Tag', kind: 'text' },
    status: { label: 'Status', kind: 'status' },
    photo_count: { label: 'Jumlah foto', kind: 'count' },
  },
  usaha: {
    name: { label: 'Nama', kind: 'text' },
    description: { label: 'Deskripsi', kind: 'text' },
    category: { label: 'Kategori', kind: 'text' },
    kind: {
      label: 'Jenis usaha',
      kind: 'text',
      values: { product: 'Produk', service: 'Jasa', both: 'Produk dan jasa' },
    },
    address_text: { label: 'Alamat', kind: 'text' },
    coordinates: { label: 'Koordinat', kind: 'text' },
    maps_url: { label: 'Tautan peta', kind: 'text' },
    phone: { label: 'Telepon', kind: 'text' },
    whatsapp: { label: 'WhatsApp', kind: 'text' },
    website: { label: 'Situs web', kind: 'text' },
    social_url: { label: 'Media sosial', kind: 'text' },
    area: { label: 'Wilayah', kind: 'opaque' },
    operational_status: {
      label: 'Status operasional',
      kind: 'text',
      values: {
        unknown: 'Belum diketahui',
        open: 'Buka',
        temporarily_closed: 'Tutup sementara',
        permanently_closed: 'Tutup permanen',
      },
    },
    status: { label: 'Status', kind: 'status' },
  },
  event: {
    name: { label: 'Nama', kind: 'text' },
    description: { label: 'Deskripsi', kind: 'text' },
    category: { label: 'Kategori', kind: 'text' },
    starts_at: { label: 'Mulai', kind: 'datetime' },
    ends_at: { label: 'Selesai', kind: 'datetime' },
    location: { label: 'Lokasi', kind: 'text' },
    coordinates: { label: 'Koordinat', kind: 'text' },
    maps_url: { label: 'Tautan peta', kind: 'text' },
    organizer: { label: 'Penyelenggara', kind: 'text' },
    source_url: { label: 'Sumber', kind: 'text' },
    area: { label: 'Wilayah', kind: 'opaque' },
    cancelled: { label: 'Pembatalan', kind: 'text' },
    status: { label: 'Status', kind: 'status' },
    poster_count: { label: 'Jumlah poster', kind: 'count', unit: 'poster' },
  },
  karya: {
    title: { label: 'Judul', kind: 'text' },
    year: { label: 'Tahun', kind: 'text' },
    kind: { label: 'Jenis', kind: 'text', values: { music: 'Musik', film: 'Film' } },
    language: { label: 'Bahasa', kind: 'text' },
    description: { label: 'Deskripsi', kind: 'text' },
    credits: { label: 'Kredit', kind: 'text' },
    access_links: { label: 'Tautan akses', kind: 'text' },
    status: { label: 'Status', kind: 'status' },
  },
  layanan: {
    name: { label: 'Nama', kind: 'text' },
    category: {
      label: 'Jenis layanan',
      kind: 'text',
      values: { ambulance: 'Ambulans', fire: 'Pemadam kebakaran' },
    },
    phones: { label: 'Nomor telepon', kind: 'text' },
    address_text: { label: 'Alamat', kind: 'text' },
    maps_url: { label: 'Tautan peta', kind: 'text' },
    coordinates: { label: 'Koordinat', kind: 'text' },
    area: { label: 'Wilayah', kind: 'opaque' },
    note: { label: 'Catatan', kind: 'text' },
    status: { label: 'Status', kind: 'status' },
  },
  community: {
    name: { label: 'Nama', kind: 'text' },
    category: { label: 'Kategori', kind: 'text' },
    description: { label: 'Deskripsi', kind: 'text' },
    logo: { label: 'Logo', kind: 'opaque' },
    cover: { label: 'Sampul', kind: 'opaque' },
    status: { label: 'Status', kind: 'status' },
  },
};

const STATUS_LABELS: Record<string, string> = {
  published: 'Tayang',
  draft: 'Draf',
  archived: 'Diarsipkan',
  restricted: 'Dibatasi',
  unpublished: 'Tidak tayang',
};

const ENTITY_NOUN: Record<ExploreEntityType, string> = {
  place: 'Wisata',
  cuisine: 'Kuliner',
  usaha: 'Usaha',
  event: 'Acara',
  karya: 'Karya',
  layanan: 'Layanan',
  community: 'Komunitas',
};

export type Snapshot = Record<string, string | number | null>;

function norm(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Snapshot publik wisata. Terima bentuk longgar supaya tidak terikat entity penuh. */
export function placeSnapshot(p: {
  name: string;
  category: string;
  type: string | null;
  shortDescription: string;
  hours: string | null;
  contact: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  regionId: string | null;
  villageId: string | null;
  status: string;
  images: ReadonlyArray<unknown>;
}): Snapshot {
  return {
    name: norm(p.name),
    category: norm(p.category),
    type: norm(p.type),
    short_description: norm(p.shortDescription),
    hours: norm(p.hours),
    contact: norm(p.contact),
    maps_url: norm(p.mapsUrl),
    coordinates: p.lat != null && p.lng != null ? `${p.lat}, ${p.lng}` : null,
    area: p.regionId || p.villageId ? `${p.regionId ?? ''}|${p.villageId ?? ''}` : null,
    status: norm(p.status),
    photo_count: p.images.length,
  };
}

/** Snapshot publik kuliner. */
export function cuisineSnapshot(c: {
  name: string;
  description: string | null;
  category: { name: string } | null;
  originRegion: string | null;
  ingredients: ReadonlyArray<string>;
  servingSuggestion: string | null;
  tags: ReadonlyArray<string>;
  publishStatus: string;
  images: ReadonlyArray<unknown>;
}): Snapshot {
  return {
    name: norm(c.name),
    description: norm(c.description),
    category: norm(c.category?.name),
    origin_region: norm(c.originRegion),
    ingredients: c.ingredients.length ? c.ingredients.join(', ') : null,
    serving_suggestion: norm(c.servingSuggestion),
    tags: c.tags.length ? c.tags.join(', ') : null,
    status: norm(c.publishStatus),
    photo_count: c.images.length,
  };
}

/** Pasang koordinat "lat, lng" bila keduanya ada. */
function coords(lat: number | null | undefined, lng: number | null | undefined): string | null {
  return lat != null && lng != null ? `${lat}, ${lng}` : null;
}

function areaOf(regionId: string | null | undefined, villageId: string | null | undefined): string | null {
  return regionId || villageId ? `${regionId ?? ''}|${villageId ?? ''}` : null;
}

/** Snapshot publik usaha. */
export function usahaSnapshot(u: {
  name: string;
  description: string | null;
  category?: { name: string } | null;
  kind: string;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  socialUrl: string | null;
  regionId: string | null;
  villageId: string | null;
  operationalStatus: string;
  publishStatus: string;
}): Snapshot {
  return {
    name: norm(u.name),
    description: norm(u.description),
    category: norm(u.category?.name),
    kind: norm(u.kind),
    address_text: norm(u.addressText),
    coordinates: coords(u.lat, u.lng),
    maps_url: norm(u.mapsUrl),
    phone: norm(u.phone),
    whatsapp: norm(u.whatsapp),
    website: norm(u.website),
    social_url: norm(u.socialUrl),
    area: areaOf(u.regionId, u.villageId),
    operational_status: norm(u.operationalStatus),
    status: norm(u.publishStatus),
  };
}

/** Snapshot publik acara. */
export function eventSnapshot(e: {
  name: string;
  description: string;
  categoryId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  locationText: string;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  organizer: string | null;
  sourceUrl: string | null;
  regionId: string | null;
  villageId: string | null;
  status: string;
  cancelledAt: Date | null;
  posterUrls: ReadonlyArray<string>;
}): Snapshot {
  return {
    name: norm(e.name),
    description: norm(e.description),
    category: norm(e.categoryId),
    starts_at: norm(e.startsAt),
    ends_at: norm(e.endsAt),
    location: norm(e.locationText),
    coordinates: coords(e.lat, e.lng),
    maps_url: norm(e.mapsUrl),
    organizer: norm(e.organizer),
    source_url: norm(e.sourceUrl),
    area: areaOf(e.regionId, e.villageId),
    cancelled: e.cancelledAt ? 'Dibatalkan' : 'Aktif',
    status: norm(e.status),
    poster_count: e.posterUrls.length,
  };
}

/** Snapshot publik karya (musik/film). */
export function karyaSnapshot(k: {
  title: string;
  year: number | null;
  kind: string;
  language: string | null;
  description: string | null;
  credits: ReadonlyArray<{ role: string; nameText: string }>;
  accessLinks: ReadonlyArray<{ label: string }>;
  publishStatus: string;
}): Snapshot {
  return {
    title: norm(k.title),
    year: norm(k.year),
    kind: norm(k.kind),
    language: norm(k.language),
    description: norm(k.description),
    credits: k.credits.length ? k.credits.map((c) => `${c.role}: ${c.nameText}`).join(', ') : null,
    access_links: k.accessLinks.length ? k.accessLinks.map((l) => l.label).join(', ') : null,
    status: norm(k.publishStatus),
  };
}

/** Snapshot publik layanan publik. */
export function layananSnapshot(l: {
  name: string;
  category: string;
  phones: ReadonlyArray<{ phone: string; note: string | null }>;
  addressText: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  regionId: string | null;
  villageId: string | null;
  note: string | null;
  publishStatus: string;
}): Snapshot {
  return {
    name: norm(l.name),
    category: norm(l.category),
    phones: l.phones.length
      ? l.phones.map((p) => (p.note ? `${p.phone} (${p.note})` : p.phone)).join(', ')
      : null,
    address_text: norm(l.addressText),
    maps_url: norm(l.mapsUrl),
    coordinates: coords(l.lat, l.lng),
    area: areaOf(l.regionId, l.villageId),
    note: norm(l.note),
    status: norm(l.publishStatus),
  };
}

/** Snapshot publik komunitas. */
export function communitySnapshot(c: {
  name: string;
  categoryName?: string | null;
  categoryId: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: string;
}): Snapshot {
  return {
    name: norm(c.name),
    category: norm(c.categoryName ?? c.categoryId),
    description: norm(c.description),
    logo: norm(c.logoUrl),
    cover: norm(c.coverUrl),
    status: norm(c.status),
  };
}

/** Field yang berubah saja; null bila tidak ada perbedaan. */
export function diffSnapshots(
  before: Snapshot,
  after: Snapshot,
): { old: Snapshot; new: Snapshot } | null {
  const o: Snapshot = {};
  const n: Snapshot = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    if (b !== a) {
      o[key] = b;
      n[key] = a;
    }
  }
  return Object.keys(n).length === 0 ? null : { old: o, new: n };
}

/** Aksi dari perubahan status; selain itu 'update'. */
export function actionForStatusChange(
  beforeStatus: string | null,
  afterStatus: string | null,
): EntityChangeAction {
  if (beforeStatus === afterStatus) return 'update';
  if (afterStatus === 'published') return 'publish';
  if (beforeStatus === 'published') return 'unpublish';
  return 'update';
}

export interface DisplayChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  displayOld: string;
  displayNew: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Pontianak',
    }).format(d);
  } catch {
    return iso;
  }
}

function show(spec: FieldSpec, v: unknown, side: 'old' | 'new'): string {
  const kind = spec.kind;
  if (v === null || v === undefined) return side === 'new' && kind === 'opaque' ? 'Dikosongkan' : '-';
  switch (kind) {
    case 'status':
      return STATUS_LABELS[String(v)] ?? String(v);
    case 'count':
      return `${v} ${spec.unit ?? 'foto'}`;
    case 'datetime':
      return formatDateTime(String(v));
    case 'opaque':
      return side === 'old' ? 'Sebelumnya' : 'Diperbarui';
    default: {
      const s = spec.values?.[String(v)] ?? String(v);
      return s.length > 300 ? `${s.slice(0, 300)}...` : s;
    }
  }
}

/** Ubah old_data/new_data audit jadi daftar perubahan siap tampil. */
export function buildDisplayChanges(
  entityType: ExploreEntityType,
  oldData: unknown,
  newData: unknown,
): DisplayChange[] {
  const specs = ENTITY_FIELDS[entityType];
  const o = (oldData ?? {}) as Record<string, unknown>;
  const n = (newData ?? {}) as Record<string, unknown>;
  const out: DisplayChange[] = [];
  for (const [field, spec] of Object.entries(specs)) {
    if (!(field in o) && !(field in n)) continue;
    const ov = o[field] ?? null;
    const nv = n[field] ?? null;
    if (ov === nv) continue;
    out.push({
      field,
      label: spec.label,
      oldValue: ov,
      newValue: nv,
      displayOld: show(spec, ov, 'old'),
      displayNew: show(spec, nv, 'new'),
    });
  }
  return out;
}

/** Judul baris timeline untuk entitas eksplorasi. */
export function describeEntityAction(
  entityType: ExploreEntityType,
  action: string,
  newData: unknown,
  oldData?: unknown,
): string {
  const noun = ENTITY_NOUN[entityType];
  switch (action) {
    case 'create':
      return `${noun} ditambahkan`;
    case 'publish':
      return `${noun} mulai tayang`;
    case 'unpublish':
      return `${noun} ditarik dari tayang`;
    case 'takedown':
      return `${noun} dihapus`;
    case 'photo_add': {
      const n = Number((newData as { added?: unknown } | null)?.added ?? 0);
      return n > 0 ? `Menambah ${n} foto` : 'Menambah foto';
    }
    case 'photo_remove': {
      const n = Number((oldData as { removed?: unknown } | null)?.removed ?? 0);
      return n > 0 ? `Menghapus ${n} foto` : 'Menghapus foto';
    }
    default:
      return 'Data diperbarui';
  }
}
