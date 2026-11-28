export type StickerVisibility = 'public' | 'private';

export interface Sticker {
  id: string;
  imageUrl: string;
  playOnce: boolean;
  sortOrder: number;
  isActive: boolean;
  /** Slug kategori berbagi; null = tanpa kategori. */
  categorySlug: string | null;
  /** Pemilik custom stiker; null = stiker katalog resmi. */
  ownerUserId: string | null;
  /** Nama tampilan opsional (terutama untuk custom stiker). */
  displayName: string | null;
  /** 'public' = katalog global; 'private' = hanya deck pemilik + favorit. */
  visibility: StickerVisibility;
  /** ID file di ImageKit untuk penghapusan fisik saat takedown/hapus. */
  providerFileId: string | null;
  /** Asal salinan hasil fork favorit; null = stiker asli. */
  sourceStickerId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface StickerListPage {
  items: Sticker[];
  nextCursor: string | null;
  categories: string[];
}
