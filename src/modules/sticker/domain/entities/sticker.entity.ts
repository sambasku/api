export interface Sticker {
  id: string;
  imageUrl: string;
  playOnce: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}
