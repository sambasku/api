export type UsahaCategoryStatus = 'draft' | 'published' | 'archived';

export interface UsahaCategoryRecord {
  id: string;
  name: string;
  status: UsahaCategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
