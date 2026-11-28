export type LayananCategoryStatus = 'published' | 'archived';

/** Nama ikon yang dikenali mobile/web. Nilai di luar daftar memakai ikon default `siren`. */
export const LAYANAN_CATEGORY_ICONS = ['ambulance', 'flame', 'cross', 'siren'] as const;
export type LayananCategoryIcon = (typeof LAYANAN_CATEGORY_ICONS)[number];

export interface LayananCategoryRecord {
  id: string;
  name: string;
  shortLabel: string;
  icon: string;
  status: LayananCategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
