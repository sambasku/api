export const LAYANAN_CATEGORIES = ['ambulance', 'fire'] as const;
export type LayananCategory = (typeof LAYANAN_CATEGORIES)[number];

export const LAYANAN_PHONES_MIN = 1;
export const LAYANAN_PHONES_MAX = 5;

/** Satu saluran telepon (bisa dengan keterangan shift / konteks). */
export interface LayananPhone {
  phone: string;
  note: string | null;
  whatsapp: string | null;
}

export interface LayananFields {
  category: LayananCategory;
  name: string;
  phones: LayananPhone[];
  logoUrl: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  regionId: string;
  villageId: string | null;
  note: string | null;
}

export interface Layanan extends LayananFields {
  id: string;
  slug: string;
  regionName: string | null;
  regionSlug: string | null;
  villageName: string | null;
  publishStatus: 'published' | 'unpublished';
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LayananContribution {
  id: string;
  kind: 'new' | 'edit';
  userId: string;
  username: string | null;
  layananId: string | null;
  payload: LayananFields;
  status: 'pending' | 'needs_revision' | 'approved' | 'rejected';
  resultLayananId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function slugifyLayanan(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'layanan';
}

export function serializePhones(phones: LayananPhone[]): string {
  return JSON.stringify(phones);
}

export function parsePhonesJson(raw: string): LayananPhone[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const phone = typeof row.phone === 'string' ? row.phone.trim() : '';
        if (!phone) return null;
        return {
          phone,
          note: typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null,
          whatsapp:
            typeof row.whatsapp === 'string' && row.whatsapp.trim()
              ? row.whatsapp.trim()
              : null,
        } satisfies LayananPhone;
      })
      .filter((p): p is LayananPhone => p != null);
  } catch {
    return [];
  }
}
