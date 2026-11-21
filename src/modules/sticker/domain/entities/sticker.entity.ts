export interface Sticker {
  id: string;
  imageUrl: string;
  playOnce: boolean;
  sortOrder: number;
  isActive: boolean;
  /** Slug kategori berbagi; null = tanpa kategori. */
  categorySlug: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface StickerListPage {
  items: Sticker[];
  nextCursor: string | null;
  categories: string[];
}
