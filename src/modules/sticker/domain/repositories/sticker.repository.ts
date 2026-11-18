import type { Sticker } from '../entities/sticker.entity';

export interface CreateStickerInput {
  id: string;
  imageUrl: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateStickerInput {
  imageUrl?: string;
  playOnce?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface StickerRepository {
  listActive(): Promise<Sticker[]>;
  listAll(): Promise<Sticker[]>;
  findActiveById(id: string): Promise<Sticker | null>;
  findById(id: string): Promise<Sticker | null>;
  create(input: CreateStickerInput): Promise<Sticker>;
  update(id: string, input: UpdateStickerInput): Promise<Sticker | null>;
  softDelete(id: string): Promise<boolean>;
}
