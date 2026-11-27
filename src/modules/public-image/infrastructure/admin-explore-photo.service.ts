import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { placeImages } from '@/shared/database/drizzle/schema/places.schema';
import { usahaImages } from '@/shared/database/drizzle/schema/usahas.schema';
import { eventImages } from '@/shared/database/drizzle/schema/event-images.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { PublicImageStoragePort } from '../application/ports/public-image-storage.port';
import {
  buildCulinaryImagePath,
  buildEventImagePath,
  buildPlaceImagePath,
  buildUsahaImagePath,
} from '../application/utils/public-image-path';
import { validateImageFile } from '../application/utils/validate-image-file';

export const EXPLORE_PHOTO_MODULES = ['place', 'culinary', 'usaha', 'event'] as const;
export type ExplorePhotoModule = (typeof EXPLORE_PHOTO_MODULES)[number];

interface CuisineImageRow {
  url: string;
  isMain?: boolean;
  attribution?: unknown;
}

function buildPath(mod: ExplorePhotoModule, mimeType: string): string {
  switch (mod) {
    case 'place':
      return buildPlaceImagePath(mimeType);
    case 'culinary':
      return buildCulinaryImagePath(mimeType);
    case 'usaha':
      return buildUsahaImagePath(mimeType);
    case 'event':
      return buildEventImagePath(mimeType);
  }
}

function parseCuisineImages(raw: string | null | undefined): CuisineImageRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CuisineImageRow[]) : [];
  } catch {
    return [];
  }
}

export class AdminExplorePhotoService {
  constructor(
    private readonly db: AppDatabase,
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async takedown(input: {
    module: ExplorePhotoModule;
    entityId: string;
    imageId?: string | null;
    imageUrl?: string | null;
    actorId: string;
    requestId?: string | null;
  }): Promise<{ url: string }> {
    const imageId = input.imageId?.trim() || null;
    const imageUrl = input.imageUrl?.trim() || null;
    if (!imageId && !imageUrl) {
      throw new ValidationError([
        { field: 'image_url', message: 'image_id atau image_url wajib diisi' },
      ]);
    }

    const now = new Date();
    let hiddenUrl: string | null = null;

    if (input.module === 'place') {
      const conds = [eq(placeImages.placeId, input.entityId), isNull(placeImages.hiddenAt)];
      if (imageId) conds.push(eq(placeImages.id, imageId));
      else conds.push(eq(placeImages.url, imageUrl!));
      const rows = await this.db
        .update(placeImages)
        .set({ hiddenAt: now })
        .where(and(...conds))
        .returning({ url: placeImages.url });
      hiddenUrl = rows[0]?.url ?? null;
      if (hiddenUrl) {
        await this.activityEvents?.safeHidePlacePhoto(input.entityId, hiddenUrl);
      }
    } else if (input.module === 'usaha') {
      const conds = [eq(usahaImages.usahaId, input.entityId), isNull(usahaImages.hiddenAt)];
      if (imageId) conds.push(eq(usahaImages.id, imageId));
      else conds.push(eq(usahaImages.url, imageUrl!));
      const rows = await this.db
        .update(usahaImages)
        .set({ hiddenAt: now })
        .where(and(...conds))
        .returning({ url: usahaImages.url });
      hiddenUrl = rows[0]?.url ?? null;
    } else if (input.module === 'event') {
      const conds = [eq(eventImages.eventId, input.entityId), isNull(eventImages.hiddenAt)];
      if (imageId) conds.push(eq(eventImages.id, imageId));
      else conds.push(eq(eventImages.url, imageUrl!));
      const rows = await this.db
        .update(eventImages)
        .set({ hiddenAt: now })
        .where(and(...conds))
        .returning({ url: eventImages.url });
      hiddenUrl = rows[0]?.url ?? null;
      if (hiddenUrl) {
        await this.activityEvents?.safeHidePlacePhoto(input.entityId, hiddenUrl);
      }
    } else {
      const [row] = await this.db
        .select({ id: cuisines.id, imagesJson: cuisines.imagesJson })
        .from(cuisines)
        .where(and(eq(cuisines.id, input.entityId), isNull(cuisines.deletedAt)))
        .limit(1);
      if (!row) throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      const imgs = parseCuisineImages(row.imagesJson);
      const target = imgs.find((i) => i.url === imageUrl);
      if (target) {
        const next = imgs.filter((i) => i.url !== target.url);
        if (next.length > 0 && !next.some((i) => i.isMain)) {
          next[0] = { ...next[0], isMain: true };
        }
        await this.db
          .update(cuisines)
          .set({
            imagesJson: next.length > 0 ? JSON.stringify(next) : null,
            updatedAt: now,
          })
          .where(eq(cuisines.id, input.entityId));
        hiddenUrl = target.url;
      }
    }

    if (!hiddenUrl) {
      throw new NotFoundError('IMAGE_NOT_FOUND', 'Foto tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'takedown',
      entityType: `${input.module}_photo`,
      entityId: input.entityId,
      oldData: { url: hiddenUrl },
      newData: { hidden: true },
      requestId: input.requestId ?? null,
    });

    return { url: hiddenUrl };
  }

  async censor(input: {
    module: ExplorePhotoModule;
    entityId: string;
    imageId?: string | null;
    imageUrl?: string | null;
    censoredBytes: Uint8Array;
    censoredMimeType?: string | null;
    actorId: string;
    requestId?: string | null;
  }): Promise<{ old_url: string; url: string }> {
    const imageId = input.imageId?.trim() || null;
    const imageUrl = input.imageUrl?.trim() || null;
    if (!imageId && !imageUrl) {
      throw new ValidationError([
        { field: 'image_url', message: 'image_id atau image_url wajib diisi' },
      ]);
    }

    const file = validateImageFile({
      bytes: input.censoredBytes,
      mimeType: input.censoredMimeType ?? null,
    });
    const uploaded = await this.publicImageStorage.upload({
      path: buildPath(input.module, file.mimeType),
      content: file.bytes,
      mimeType: file.mimeType,
    });

    let oldUrl: string | null = null;
    const now = new Date();

    if (input.module === 'place') {
      const conds = [eq(placeImages.placeId, input.entityId), isNull(placeImages.hiddenAt)];
      if (imageId) conds.push(eq(placeImages.id, imageId));
      else conds.push(eq(placeImages.url, imageUrl!));
      const [existing] = await this.db
        .select({ id: placeImages.id, url: placeImages.url })
        .from(placeImages)
        .where(and(...conds))
        .limit(1);
      if (existing) {
        oldUrl = existing.url;
        await this.db
          .update(placeImages)
          .set({ url: uploaded.url })
          .where(eq(placeImages.id, existing.id));
      }
    } else if (input.module === 'usaha') {
      const conds = [eq(usahaImages.usahaId, input.entityId), isNull(usahaImages.hiddenAt)];
      if (imageId) conds.push(eq(usahaImages.id, imageId));
      else conds.push(eq(usahaImages.url, imageUrl!));
      const [existing] = await this.db
        .select({ id: usahaImages.id, url: usahaImages.url })
        .from(usahaImages)
        .where(and(...conds))
        .limit(1);
      if (existing) {
        oldUrl = existing.url;
        await this.db
          .update(usahaImages)
          .set({ url: uploaded.url })
          .where(eq(usahaImages.id, existing.id));
      }
    } else if (input.module === 'event') {
      const conds = [eq(eventImages.eventId, input.entityId), isNull(eventImages.hiddenAt)];
      if (imageId) conds.push(eq(eventImages.id, imageId));
      else conds.push(eq(eventImages.url, imageUrl!));
      const [existing] = await this.db
        .select({ id: eventImages.id, url: eventImages.url })
        .from(eventImages)
        .where(and(...conds))
        .limit(1);
      if (existing) {
        oldUrl = existing.url;
        await this.db
          .update(eventImages)
          .set({ url: uploaded.url })
          .where(eq(eventImages.id, existing.id));
      }
    } else {
      const [row] = await this.db
        .select({ id: cuisines.id, imagesJson: cuisines.imagesJson })
        .from(cuisines)
        .where(and(eq(cuisines.id, input.entityId), isNull(cuisines.deletedAt)))
        .limit(1);
      if (!row) throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      const imgs = parseCuisineImages(row.imagesJson);
      const idx = imgs.findIndex((i) => i.url === imageUrl);
      if (idx >= 0) {
        oldUrl = imgs[idx].url;
        imgs[idx] = { ...imgs[idx], url: uploaded.url };
        await this.db
          .update(cuisines)
          .set({ imagesJson: JSON.stringify(imgs), updatedAt: now })
          .where(eq(cuisines.id, input.entityId));
      }
    }

    if (!oldUrl) {
      throw new NotFoundError('IMAGE_NOT_FOUND', 'Foto tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'update',
      entityType: `${input.module}_photo`,
      entityId: input.entityId,
      oldData: { url: oldUrl },
      newData: { url: uploaded.url, censored: true },
      requestId: input.requestId ?? null,
    });

    return { old_url: oldUrl, url: uploaded.url };
  }
}
