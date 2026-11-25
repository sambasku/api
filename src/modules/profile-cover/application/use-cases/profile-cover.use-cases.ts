import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import {
  PROFILE_COVER_DIMENSIONS,
  PROFILE_COVER_VARIANTS,
  type ProfileCover,
  type ProfileCoverVariant,
} from '../../domain/entities/profile-cover.entity';
import type { ProfileCoverRepository } from '../../domain/repositories/profile-cover.repository';

function assertHttpsUrl(url: string, field = 'url'): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) {
    throw new ValidationError([
      { field, message: 'URL cover harus https' },
    ]);
  }
  return trimmed;
}

function assertVariant(raw: string): ProfileCoverVariant {
  const v = raw.trim() as ProfileCoverVariant;
  if (!PROFILE_COVER_VARIANTS.includes(v)) {
    throw new ValidationError([
      { field: 'variant', message: 'Varian harus tab, public, atau wotd' },
    ]);
  }
  return v;
}

function assertDimensions(
  variant: ProfileCoverVariant,
  width: number,
  height: number,
): void {
  const expected = PROFILE_COVER_DIMENSIONS[variant];
  if (width !== expected.width || height !== expected.height) {
    throw new ValidationError([
      {
        field: 'width',
        message: `Ukuran cover ${variant} harus ${expected.width}x${expected.height}`,
      },
    ]);
  }
}

export class ListProfileCoversUseCase {
  constructor(private readonly repo: ProfileCoverRepository) {}

  execute(variant: ProfileCoverVariant): Promise<ProfileCover[]> {
    return this.repo.listByVariant(variant);
  }
}

export class GetActiveProfileCoversUseCase {
  constructor(private readonly repo: ProfileCoverRepository) {}

  execute() {
    return this.repo.getActiveUrls();
  }
}

export class CreateProfileCoverUseCase {
  constructor(
    private readonly repo: ProfileCoverRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    variant: string;
    url: string;
    fileId?: string | null;
    width: number;
    height: number;
    sizeBytes?: number | null;
    activate?: boolean;
    actorId: string | null;
  }): Promise<ProfileCover> {
    const variant = assertVariant(cmd.variant);
    const url = assertHttpsUrl(cmd.url);
    assertDimensions(variant, cmd.width, cmd.height);
    const activate = cmd.activate !== false;
    const id = crypto.randomUUID();
    const created = await this.repo.create({
      id,
      variant,
      url,
      fileId: cmd.fileId?.trim() || null,
      width: cmd.width,
      height: cmd.height,
      sizeBytes: cmd.sizeBytes ?? null,
      isActive: activate,
      createdBy: cmd.actorId,
      activatedAt: activate ? new Date() : null,
    });
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'profile_cover',
      entityId: created.id,
      newData: { variant: created.variant, url: created.url },
    });
    return created;
  }
}

export class ActivateProfileCoverUseCase {
  constructor(
    private readonly repo: ProfileCoverRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(id: string, actorId: string | null): Promise<ProfileCover> {
    const trimmed = id.trim();
    const existing = await this.repo.findById(trimmed);
    if (!existing) {
      throw new NotFoundError(
        'PROFILE_COVER_NOT_FOUND',
        'Cover profil tidak ditemukan',
      );
    }
    const activated = await this.repo.activate(trimmed);
    await this.auditRepo?.record({
      userId: actorId,
      action: 'activate',
      entityType: 'profile_cover',
      entityId: activated.id,
      newData: { variant: activated.variant },
    });
    return activated;
  }
}

export class DeleteProfileCoverUseCase {
  constructor(
    private readonly repo: ProfileCoverRepository,
    private readonly imageStorage?: ImageStoragePort,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(id: string, actorId: string | null): Promise<void> {
    const trimmed = id.trim();
    const existing = await this.repo.findById(trimmed);
    if (!existing) {
      throw new NotFoundError(
        'PROFILE_COVER_NOT_FOUND',
        'Cover profil tidak ditemukan',
      );
    }
    if (existing.isActive) {
      throw new ConflictError(
        'PROFILE_COVER_ACTIVE',
        'Cover yang sedang aktif tidak bisa dihapus. Aktifkan cover lain dulu.',
      );
    }
    await this.repo.deleteById(trimmed);
    if (existing.fileId && this.imageStorage) {
      try {
        await this.imageStorage.deleteFile(existing.fileId);
      } catch {
        // CDN cleanup best-effort
      }
    }
    await this.auditRepo?.record({
      userId: actorId,
      action: 'delete',
      entityType: 'profile_cover',
      entityId: trimmed,
      oldData: { variant: existing.variant, url: existing.url },
    });
  }
}