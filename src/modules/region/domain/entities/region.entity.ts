export type RegionType = 'kecamatan' | 'desa';
export type RegionStatus = 'draft' | 'published' | 'archived';

export interface Region {
  id: string;
  slug: string;
  name: string;
  type: RegionType;
  parentId: string | null;
  code: string | null;
  lat: number | null;
  lng: number | null;
  status: RegionStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
