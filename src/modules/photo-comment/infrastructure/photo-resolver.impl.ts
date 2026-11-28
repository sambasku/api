import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { eventImages } from '@/shared/database/drizzle/schema/event-images.schema';
import { events } from '@/shared/database/drizzle/schema/events.schema';
import { placeImages, places } from '@/shared/database/drizzle/schema/places.schema';
import {
  usahaImages,
  usahas,
} from '@/shared/database/drizzle/schema/usahas.schema';
import { wordImages } from '@/shared/database/drizzle/schema/word-images.schema';
import { words } from '@/shared/database/drizzle/schema/words.schema';
import type {
  PhotoCommentKind,
  ResolvedPhoto,
} from '../domain/entities/photo-comment.entity';
import {
  parseCuisinePhotoRef,
  photoUrlHash,
} from '../domain/photo-ref';
import type { PhotoResolver } from '../domain/repositories/photo-comment.repository';

/** `attribution_json` foto wisata/usaha/acara -> authorId (null = stock). */
function authorIdFromAttribution(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const id = parsed?.authorId ?? parsed?.author_id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Resolve foto UGC per jenis dalam SATU query per panggilan (JOIN foto + host).
 * Foto hanya valid bila foto tidak tersembunyi dan host tayang.
 */
export class PhotoResolverImpl implements PhotoResolver {
  constructor(private readonly db: AppDatabase) {}

  async resolve(
    kind: PhotoCommentKind,
    ref: string,
  ): Promise<ResolvedPhoto | null> {
    switch (kind) {
      case 'word':
        return this.resolveWord(ref);
      case 'place':
        return this.resolvePlace(ref);
      case 'usaha':
        return this.resolveUsaha(ref);
      case 'event':
        return this.resolveEvent(ref);
      case 'cuisine':
        return this.resolveCuisine(ref);
      default: {
        const _exhaustive: never = kind;
        throw new Error(`jenis foto tidak dikenal: ${_exhaustive}`);
      }
    }
  }

  private async resolveWord(ref: string): Promise<ResolvedPhoto | null> {
    const [row] = await this.db
      .select({
        wordId: wordImages.wordId,
        lemma: words.lemma,
        createdBy: wordImages.createdBy,
      })
      .from(wordImages)
      .innerJoin(words, eq(words.id, wordImages.wordId))
      .where(
        and(
          eq(wordImages.id, ref),
          eq(wordImages.status, 'published'),
          isNull(wordImages.deletedAt),
          eq(words.status, 'published'),
          isNull(words.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      kind: 'word',
      ref,
      hostId: row.wordId,
      hostKey: row.wordId,
      hostLabel: row.lemma,
      uploaderId: row.createdBy ?? null,
    };
  }

  private async resolvePlace(ref: string): Promise<ResolvedPhoto | null> {
    const [row] = await this.db
      .select({
        placeId: placeImages.placeId,
        slug: places.slug,
        name: places.name,
        attributionJson: placeImages.attributionJson,
      })
      .from(placeImages)
      .innerJoin(places, eq(places.id, placeImages.placeId))
      .where(
        and(
          eq(placeImages.id, ref),
          isNull(placeImages.hiddenAt),
          eq(places.status, 'published'),
          isNull(places.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      kind: 'place',
      ref,
      hostId: row.placeId,
      hostKey: row.slug,
      hostLabel: row.name,
      uploaderId: authorIdFromAttribution(row.attributionJson),
    };
  }

  private async resolveUsaha(ref: string): Promise<ResolvedPhoto | null> {
    const [row] = await this.db
      .select({
        usahaId: usahaImages.usahaId,
        slug: usahas.slug,
        name: usahas.name,
        attributionJson: usahaImages.attributionJson,
      })
      .from(usahaImages)
      .innerJoin(usahas, eq(usahas.id, usahaImages.usahaId))
      .where(
        and(
          eq(usahaImages.id, ref),
          isNull(usahaImages.hiddenAt),
          eq(usahas.publishStatus, 'published'),
          isNull(usahas.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      kind: 'usaha',
      ref,
      hostId: row.usahaId,
      hostKey: row.slug,
      hostLabel: row.name,
      uploaderId: authorIdFromAttribution(row.attributionJson),
    };
  }

  private async resolveEvent(ref: string): Promise<ResolvedPhoto | null> {
    const [row] = await this.db
      .select({
        eventId: eventImages.eventId,
        slug: events.slug,
        name: events.name,
        attributionJson: eventImages.attributionJson,
      })
      .from(eventImages)
      .innerJoin(events, eq(events.id, eventImages.eventId))
      .where(
        and(
          eq(eventImages.id, ref),
          isNull(eventImages.hiddenAt),
          eq(events.status, 'published'),
          isNull(events.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      kind: 'event',
      ref,
      hostId: row.eventId,
      hostKey: row.slug,
      hostLabel: row.name,
      uploaderId: authorIdFromAttribution(row.attributionJson),
    };
  }

  /** Ref kuliner = `<cuisineId>.<hash URL>`; cocokkan hash dengan `images_json`. */
  private async resolveCuisine(ref: string): Promise<ResolvedPhoto | null> {
    const parsed = parseCuisinePhotoRef(ref);
    if (!parsed) return null;
    const [row] = await this.db
      .select({
        id: cuisines.id,
        slug: cuisines.slug,
        name: cuisines.name,
        imagesJson: cuisines.imagesJson,
      })
      .from(cuisines)
      .where(
        and(
          eq(cuisines.id, parsed.cuisineId),
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
        ),
      )
      .limit(1);
    if (!row?.imagesJson) return null;
    let images: unknown;
    try {
      images = JSON.parse(row.imagesJson);
    } catch {
      return null;
    }
    if (!Array.isArray(images)) return null;
    for (const raw of images as Array<Record<string, unknown>>) {
      const url = typeof raw?.url === 'string' ? raw.url : '';
      if (!url || photoUrlHash(url) !== parsed.hash) continue;
      const attribution = raw.attribution as Record<string, unknown> | null;
      const authorId = attribution?.authorId;
      return {
        kind: 'cuisine',
        ref,
        hostId: row.id,
        hostKey: row.slug,
        hostLabel: row.name,
        uploaderId:
          typeof authorId === 'string' && authorId.length > 0 ? authorId : null,
      };
    }
    return null;
  }
}
