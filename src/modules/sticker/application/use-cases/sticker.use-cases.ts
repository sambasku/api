import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Sticker } from '../../domain/entities/sticker.entity';
import type { StickerRepository } from '../../domain/repositories/sticker.repository';

const SLUG_RE = /^[a-z0-9_-]{1,64}$/;

function assertSlug(id: string): string {
  const trimmed = id.trim().toLowerCase();
  if (!SLUG_RE.test(trimmed)) {
    throw new ValidationError([
      {
        field: 'id',
        message: 'Id stiker hanya huruf kecil, angka, _ atau - (maks 64)',
      },
    ]);
  }
  return trimmed;
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

export class ListActiveStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(): Promise<Sticker[]> {
    return this.repo.listActive();
  }
}

export class ListAdminStickersUseCase {
  constructor(private readonly repo: StickerRepository) {}

  execute(): Promise<Sticker[]> {
    return this.repo.listAll();
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
    actorId: string;
    requestId?: string | null;
  }): Promise<Sticker> {
    const id = assertSlug(cmd.id);
    const imageUrl = assertImageUrl(cmd.imageUrl);
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
    });
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'sticker',
      entityId: created.id,
      newData: { imageUrl: created.imageUrl },
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
    actorId: string;
    requestId?: string | null;
  }): Promise<Sticker> {
    const imageUrl =
      cmd.imageUrl !== undefined ? assertImageUrl(cmd.imageUrl) : undefined;
    const updated = await this.repo.update(cmd.id, {
      imageUrl,
      playOnce: cmd.playOnce,
      sortOrder: cmd.sortOrder,
      isActive: cmd.isActive,
    });
    if (!updated) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
    }
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'sticker',
      entityId: updated.id,
      newData: { imageUrl: updated.imageUrl, isActive: updated.isActive },
      requestId: cmd.requestId ?? null,
    });
    return updated;
  }
}

export class DeleteStickerUseCase {
  constructor(
    private readonly repo: StickerRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    id: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<void> {
    const ok = await this.repo.softDelete(cmd.id);
    if (!ok) {
      throw new NotFoundError('STICKER_NOT_FOUND', 'Stiker tidak ditemukan');
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
