import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type {
  ImageStoragePort,
  UploadCredentials,
} from '@/modules/image/application/ports/image-storage.port';
import type {
  Sticker,
  StickerListPage,
} from '../../domain/entities/sticker.entity';
import type {
  AdminStickerVisibilityFilter,
  ListActiveStickersQuery,
  StickerRepository,
} from '../../domain/repositories/sticker.repository';

export const MAX_FAVORITE_STICKERS = 50;
export const MAX_CUSTOM_STICKERS = 20;
const CUSTOM_STICKER_FOLDER = '/stickers/custom';
const SLUG_RE = /^[a-z0-9_-]{1,64}$/;
const MAX_CUSTOM_SLUG_LEN = 37; // 37 + '-' (1) + ULID (26) = 64

function assertSlug(id: string, field = 'id'): string {
  const trimmed = id.trim().toLowerCase();
  if (!SLUG_RE.test(trimmed)) {
    throw new ValidationError([
      {
        field,
        message: 'Slug hanya huruf kecil, angka, _ atau - (maks 64)',
      },
    ]);
  }
  return trimmed;
}

function normalizeCategorySlug(
  raw: string | null | undefined,
): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return assertSlug(trimmed, 'category_slug');
}

function assertImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) {
    throw new ValidationError([
      { field: 'image_url', message: 'URL gambar stiker harus https' },
    ]);
  }
  return trimmed;
}

function assertCustomImageUrl(url: string, allowedPrefix?: string): string {
  const trimmed = assertImageUrl(url);
  const endpoint = (allowedPrefix ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (endpoint && !trimmed.startsWith(`${endpoint}/`)) {
    throw new ValidationError([
      {
        field: 'image_url',
        message: 'URL gambar stiker harus berasal dari penyimpanan resmi',
      },
    ]);
  }
  return trimmed;
}

/**
 * Bangun ID custom stiker `<slug-nama>-<ulid_lowercase>` (maks 64 karakter).
 */
export function buildCustomStickerId(
  name?: string | null,
  ulidValue?: string,
): string {
  const ulid = (ulidValue ?? generateId()).trim().toLowerCase();
  const slug = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_CUSTOM_SLUG_LEN)
    .replace(/-+$/g, '');
  const prefix = slug.length > 0 ? slug : 'stiker';
  return `${prefix}-${ulid}`;
}

export class ListActiveStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(query: ListActiveStickersQuery = {}): Promise<StickerListPage> {
    return this.repo.listActivePage(query);
  }
}

export class ListAdminStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(visibility: AdminStickerVisibilityFilter = 'all'): Promise<Sticker[]> {
    return this.repo.listAll(visibility);
  }
}

export class GetActiveStickerUseCase {
  constructor(private readonly repo: StickerRepository) {}

  async execute(id: string): Promise<Sticker> {
    const found = await this.repo.findActiveById(id.trim());
    if (!found) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    return found;
  }
}

export class CreateStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    id: string;
    imageUrl: string;
    playOnce?: boolean;
    sortOrder?: number;
    isActive?: boolean;
    categorySlug?: string | null;
    actorId: string;
    requestId?: string | null;
  }): Promise<Sticker> {
    const id = assertSlug(cmd.id);
    const imageUrl = assertImageUrl(cmd.imageUrl);
    const categorySlug = normalizeCategorySlug(cmd.categorySlug) ?? null;
    const existing = await this.repo.findById(id);
    if (existing) {
      throw new ConflictError(
        'STICKER_ID_EXISTS',
        'Id stiker sudah dipakai. Pilih id lain.',
      );
    }
    const created = await this.repo.create({
      id,
      imageUrl,
      playOnce: cmd.playOnce,
      sortOrder: cmd.sortOrder,
      isActive: cmd.isActive,
      categorySlug,
      visibility: 'public',
    });
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'sticker',
      entityId: created.id,
      newData: {
        imageUrl: created.imageUrl,
        categorySlug: created.categorySlug,
      },
      requestId: cmd.requestId ?? null,
    });
    return created;
  }
}

export class UpdateStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    id: string;
    imageUrl?: string;
    playOnce?: boolean;
    sortOrder?: number;
    isActive?: boolean;
    categorySlug?: string | null;
    actorId: string;
    requestId?: string | null;
  }): Promise<Sticker> {
    const imageUrl =
      cmd.imageUrl !== undefined ? assertImageUrl(cmd.imageUrl) : undefined;
    const categorySlug = normalizeCategorySlug(cmd.categorySlug);
    const updated = await this.repo.update(cmd.id, {
      imageUrl,
      playOnce: cmd.playOnce,
      sortOrder: cmd.sortOrder,
      isActive: cmd.isActive,
      categorySlug,
    });
    if (!updated) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'sticker',
      entityId: updated.id,
      newData: {
        imageUrl: updated.imageUrl,
        isActive: updated.isActive,
        categorySlug: updated.categorySlug,
      },
      requestId: cmd.requestId ?? null,
    });
    return updated;
  }
}

export class DeleteStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly auditRepo?: AuditLogRepository,
    private readonly imageStorage?: ImageStoragePort,
  ) {}

  async execute(cmd: {
    id: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<void> {
    const deleted = await this.repo.softDelete(cmd.id);
    if (!deleted) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    if (deleted.providerFileId && this.imageStorage) {
      await this.imageStorage.deleteFile(deleted.providerFileId);
    }
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'delete',
      entityType: 'sticker',
      entityId: cmd.id,
      newData: { deleted: true },
      requestId: cmd.requestId ?? null,
    });
  }
}

// --- Favorit Stiker per User ---

export class ListFavoriteStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(userId: string): Promise<Sticker[]> {
    return this.repo.listFavorites(userId);
  }
}

export class AddFavoriteStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly maxFavorites = MAX_FAVORITE_STICKERS,
  ) {}

  async execute(cmd: { userId: string; stickerId: string }): Promise<Sticker> {
    const sid = cmd.stickerId.trim();
    const sticker = await this.repo.findActiveById(sid);
    if (!sticker) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    // Katalog resmi atau milik sendiri: favorit berupa referensi biasa.
    if (sticker.ownerUserId === null || sticker.ownerUserId === cmd.userId) {
      return this.addReference(cmd.userId, sticker);
    }
    // Stiker milik orang lain: favorit = salinan milik favoriter (fork),
    // supaya penghapusan oleh pemilik tidak menghilangkannya dari deck.
    const copy = await this.repo.findOwnedCopy(cmd.userId, sticker.id);
    if (copy) {
      return this.addReference(cmd.userId, copy);
    }
    // Favorit lama yang masih referensi ke asal tetap dihormati.
    if (await this.repo.isFavorite(cmd.userId, sticker.id)) {
      return sticker;
    }
    await this.assertFavoriteRoom(cmd.userId);
    const created = await this.createCopy(cmd.userId, sticker);
    await this.repo.addFavorite(cmd.userId, created.id);
    return created;
  }

  private async addReference(userId: string, sticker: Sticker): Promise<Sticker> {
    if (await this.repo.isFavorite(userId, sticker.id)) {
      return sticker;
    }
    await this.assertFavoriteRoom(userId);
    await this.repo.addFavorite(userId, sticker.id);
    return sticker;
  }

  private async assertFavoriteRoom(userId: string): Promise<void> {
    const total = await this.repo.countFavorites(userId);
    if (total >= this.maxFavorites) {
      throw new BadRequestError(
        'STICKER_FAVORITE_LIMIT_REACHED',
        `Favorit stiker sudah penuh (maksimal ${this.maxFavorites}). Hapus beberapa dulu ya.`,
      );
    }
  }

  private async createCopy(userId: string, source: Sticker): Promise<Sticker> {
    try {
      return await this.repo.create({
        id: buildCustomStickerId(source.displayName),
        imageUrl: source.imageUrl,
        playOnce: source.playOnce,
        sortOrder: 0,
        isActive: true,
        categorySlug: null,
        ownerUserId: userId,
        displayName: source.displayName,
        visibility: 'private',
        providerFileId: source.providerFileId,
        sourceStickerId: source.id,
      });
    } catch (e) {
      // Tap ganda: request lain sudah membuat salinan (unique index).
      const existing = await this.repo.findOwnedCopy(userId, source.id);
      if (existing) return existing;
      throw e;
    }
  }
}

export class RemoveFavoriteStickerUseCase {
  constructor(private readonly repo: StickerRepository) {}

  async execute(cmd: { userId: string; stickerId: string }): Promise<void> {
    const sid = cmd.stickerId.trim();
    if (!sid) return;
    await this.repo.removeFavorite(cmd.userId, sid);
  }
}

// --- Custom Stiker Privat per User ---

export class GetStickerUploadTokenUseCase {
  constructor(private readonly imageStorage?: ImageStoragePort) {}

  async execute(): Promise<UploadCredentials> {
    if (!this.imageStorage) {
      throw new ServiceUnavailableError(
        'IMAGE_UPLOAD_UNAVAILABLE',
        'Penyimpanan gambar belum tersedia',
      );
    }
    return this.imageStorage.createUploadCredentials(CUSTOM_STICKER_FOLDER);
  }
}

export class ListMyStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(userId: string): Promise<Sticker[]> {
    return this.repo.listByOwner(userId);
  }
}

export class CreateMyStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly options?: {
      maxCustom?: number;
      allowedUrlPrefix?: string;
    },
  ) {}

  async execute(cmd: {
    userId: string;
    name?: string | null;
    imageUrl: string;
    providerFileId?: string | null;
    playOnce?: boolean;
  }): Promise<Sticker> {
    const maxCustom = this.options?.maxCustom ?? MAX_CUSTOM_STICKERS;
    const rawName = cmd.name?.trim() ?? '';
    if (rawName.length > 30) {
      throw new ValidationError([
        { field: 'name', message: 'Nama stiker maksimal 30 karakter' },
      ]);
    }
    const imageUrl = assertCustomImageUrl(
      cmd.imageUrl,
      this.options?.allowedUrlPrefix,
    );
    const total = await this.repo.countActiveByOwner(cmd.userId);
    if (total >= maxCustom) {
      throw new BadRequestError(
        'CUSTOM_STICKER_LIMIT_REACHED',
        `Custom stiker kamu sudah penuh (maksimal ${maxCustom}). Hapus stiker lama dulu ya.`,
      );
    }
    const id = buildCustomStickerId(rawName || null);
    return this.repo.create({
      id,
      imageUrl,
      playOnce: cmd.playOnce ?? false,
      sortOrder: 0,
      isActive: true,
      categorySlug: null,
      ownerUserId: cmd.userId,
      displayName: rawName.length > 0 ? rawName : null,
      visibility: 'private',
      providerFileId: cmd.providerFileId?.trim() || null,
    });
  }
}

export class DeleteMyStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly imageStorage?: ImageStoragePort,
  ) {}

  async execute(cmd: { userId: string; stickerId: string }): Promise<void> {
    const deleted = await this.repo.softDeleteByOwner(
      cmd.stickerId.trim(),
      cmd.userId,
    );
    if (!deleted) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    if (deleted.sourceStickerId) {
      // Salinan dihapus pemiliknya: hilang juga dari favoritnya sendiri.
      await this.repo.clearFavoritesOf(deleted.id);
    }
    if (deleted.providerFileId && this.imageStorage) {
      const inUse = await this.repo.isStickerFileInUse(
        deleted.id,
        deleted.providerFileId,
      );
      if (!inUse) {
        await this.imageStorage.deleteFile(deleted.providerFileId);
      }
    }
  }
}
