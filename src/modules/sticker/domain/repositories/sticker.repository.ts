import type {
  Sticker,
  StickerListPage,
  StickerVisibility,
} from '../entities/sticker.entity';

export interface CreateStickerInput {
  id: string;
  imageUrl: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  categorySlug?: string | null;
  ownerUserId?: string | null;
  displayName?: string | null;
  visibility?: StickerVisibility;
  providerFileId?: string | null;
}

export interface UpdateStickerInput {
  imageUrl?: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  /** `undefined` = tidak diubah; `null` = clear kategori. */
  categorySlug?: string | null;
  displayName?: string | null;
}

export interface ListActiveStickersQuery {
  q?: string | null;
  categorySlug?: string | null;
  limit?: number;
  cursor?: string | null;
}

export type AdminStickerVisibilityFilter = 'all' | StickerVisibility;

export interface StickerRepository {
  listActivePage(query: ListActiveStickersQuery): Promise<StickerListPage>;
  listAll(visibility?: AdminStickerVisibilityFilter): Promise<Sticker[]>;
  findActiveById(id: string): Promise<Sticker | null>;
  /**
   * 1 query (LEFT JOIN user_sticker_favorites):
   * aktif DAN (visibility='public' OR owner_user_id=userId OR ada di favorit userId).
   */
  findUsableByUser(id: string, userId: string): Promise<Sticker | null>;
  findById(id: string): Promise<Sticker | null>;
  create(input: CreateStickerInput): Promise<Sticker>;
  update(id: string, input: UpdateStickerInput): Promise<Sticker | null>;
  softDelete(id: string): Promise<Sticker | null>;
  softDeleteByOwner(id: string, ownerUserId: string): Promise<Sticker | null>;

  // Favorit per user
  listFavorites(userId: string): Promise<Sticker[]>;
  countFavorites(userId: string): Promise<number>;
  isFavorite(userId: string, stickerId: string): Promise<boolean>;
  addFavorite(userId: string, stickerId: string): Promise<void>;
  removeFavorite(userId: string, stickerId: string): Promise<void>;

  // Custom stiker milik user
  listByOwner(ownerUserId: string): Promise<Sticker[]>;
  countActiveByOwner(ownerUserId: string): Promise<number>;
}
