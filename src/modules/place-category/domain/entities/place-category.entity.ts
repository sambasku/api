export type PlaceCategoryStatus = 'draft' | 'published' | 'archived';

export interface PlaceCategoryRecord {
  id: string;
  name: string;
  status: PlaceCategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
