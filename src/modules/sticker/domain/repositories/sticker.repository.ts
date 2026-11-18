import type { Sticker, StickerListPage } from '../entities/sticker.entity';

export interface CreateStickerInput {
  id: string;
  imageUrl: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  categorySlug?: string | null;
}

export interface UpdateStickerInput {
  imageUrl?: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  /** `undefined` = tidak diubah; `null` = clear kategori. */
  categorySlug?: string | null;
}

export interface ListActiveStickersQuery {
  q?: string | null;
  categorySlug?: string | null;
  limit?: number;
  cursor?: string | null;
}

export interface StickerRepository {
  listActivePage(query: ListActiveStickersQuery): Promise<StickerListPage>;
  listAll(): Promise<Sticker[]>;
  findActiveById(id: string): Promise<Sticker | null>;
  findById(id: string): Promise<Sticker | null>;
  create(input: CreateStickerInput): Promise<Sticker>;
  update(id: string, input: UpdateStickerInput): Promise<Sticker | null>;
  softDelete(id: string): Promise<boolean>;
}
