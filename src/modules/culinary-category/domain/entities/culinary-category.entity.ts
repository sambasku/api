export type CulinaryCategoryStatus = 'draft' | 'published' | 'archived';

export interface CulinaryCategoryRecord {
  id: string;
  name: string;
  status: CulinaryCategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
