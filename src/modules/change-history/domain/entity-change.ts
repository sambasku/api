// Riwayat perubahan entitas eksplorasi (wisata, kuliner, dst).
//
// Sumber data: `audit_logs` (entity_type = 'place' | 'cuisine', old_data/new_data
// = snapshot field PUBLIK yang berubah). Hanya field yang tampil di detail
// publik yang boleh masuk snapshot - jangan pernah isi dengan data privat.

export type ExploreEntityType = 'place' | 'cuisine';

export type EntityChangeAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'takedown'
  | 'photo_add'
  | 'photo_remove';

type FieldKind = 'text' | 'status' | 'count' | 'opaque';

interface FieldSpec {
  label: string;
  kind: FieldKind;
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
};

const STATUS_LABELS: Record<string, string> = {
  published: 'Tayang',
  draft: 'Draf',
  archived: 'Diarsipkan',
  restricted: 'Dibatasi',
};

const ENTITY_NOUN: Record<ExploreEntityType, string> = {
  place: 'Wisata',
  cuisine: 'Kuliner',
};

export type Snapshot = Record<string, string | number | null>;

function norm(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return v;
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

function show(kind: FieldKind, v: unknown, side: 'old' | 'new'): string {
  if (v === null || v === undefined) return side === 'new' && kind === 'opaque' ? 'Dikosongkan' : '-';
  switch (kind) {
    case 'status':
      return STATUS_LABELS[String(v)] ?? String(v);
    case 'count':
      return `${v} foto`;
    case 'opaque':
      return side === 'old' ? 'Sebelumnya' : 'Diperbarui';
    default: {
      const s = String(v);
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
      displayOld: show(spec.kind, ov, 'old'),
      displayNew: show(spec.kind, nv, 'new'),
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
