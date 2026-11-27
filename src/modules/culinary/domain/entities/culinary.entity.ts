import type { CommentAudio, CommentImage } from '@/modules/comment/domain/entities/comment.entity';
import type {
  CuisinePublishStatus,
} from '@/shared/database/drizzle/schema/cuisines.schema';
import type { CuisineCommentStatus } from '@/shared/database/drizzle/schema/cuisine-comments.schema';
import type { CuisineUsahaAvailability } from '@/shared/database/drizzle/schema/cuisine-usahas.schema';

export interface CulinaryCategoryRef {
  id: string;
  name: string;
}

export interface CuisineComment {
  id: string;
  cuisineId: string;
  parentId: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  authorDeletedAt: Date | null;
  body: string;
  stickerId: string | null;
  audio: CommentAudio | null;
  image: CommentImage | null;
  status: CuisineCommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: CuisineComment[];
}

/** Atribusi gambar - disimpan verbatim (PRD kuliner 13). */
export interface CuisineImage {
  url: string;
  isMain: boolean;
  attribution: {
    name?: string;
    provider?: string;
    url?: string;
    license?: string;
    license_url?: string;
    /** #281: pengunggah foto append (rate-limit harian). */
    authorId?: string;
    /** #281: ISO waktu unggah append. */
    uploadedAt?: string;
  } | null;
}

export interface CuisineSource {
  name: string;
  type: string;
  address: string;
  license?: string | null;
  licenseUrl?: string | null;
}

/** Pengusul live (JOIN users). Null = anonim / akun hilang. */
export interface CulinaryAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

export interface Cuisine {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: CulinaryCategoryRef | null;
  originRegion: string | null;
  images: CuisineImage[];
  ingredients: string[];
  servingSuggestion: string | null;
  tags: string[];
  sources: CuisineSource[];
  license: string | null;
  publishStatus: CuisinePublishStatus;
  restrictedReason: string | null;
  restrictedAt: Date | null;
  authorId: string | null;
  /** Diisi di path detail; list boleh null. */
  author: CulinaryAuthorRef | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

/** Baris relasi kuliner <-> usaha + nama tampil (hasil JOIN). */
export interface CuisineUsahaLink {
  id: string;
  cuisineId: string;
  usahaId: string;
  availability: CuisineUsahaAvailability;
  note: string | null;
  cuisineName: string | null;
  cuisineSlug: string | null;
  usahaName: string | null;
  usahaSlug: string | null;
}

export interface CuisineDetail extends Cuisine {
  /** Usaha yang menjual kuliner ini (published saja). */
  usahas: CuisineUsahaLink[];
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Pastikan tepat satu cover: true pertama menang; kalau tidak ada, index 0.
 */
export function ensureOneMainImage<T extends { isMain?: boolean }>(
  images: T[],
): Array<T & { isMain: boolean }> {
  if (images.length === 0) return [];
  const normalized = images.map((img) => ({
    ...img,
    isMain: img.isMain === true,
  }));
  const firstMainIdx = normalized.findIndex((img) => img.isMain);
  if (firstMainIdx < 0) {
    return normalized.map((img, i) => ({ ...img, isMain: i === 0 }));
  }
  return normalized.map((img, i) => ({
    ...img,
    isMain: i === firstMainIdx,
  }));
}

export function mapImages(raw: string | null): CuisineImage[] {
  return ensureOneMainImage(
    parseJsonArray<Record<string, unknown>>(raw).map((img) => ({
      url: String(img.url ?? ''),
      isMain: img.isMain === true,
      attribution: (img.attribution as CuisineImage['attribution']) ?? null,
    })),
  );
}

export function mapSources(raw: string | null): CuisineSource[] {
  return parseJsonArray<Record<string, unknown>>(raw).map((src) => ({
    name: String(src.name ?? ''),
    type: String(src.type ?? 'other'),
    address: String(src.address ?? ''),
    license: (src.license as string | null) ?? null,
    licenseUrl: (src.licenseUrl as string | null) ?? null,
  }));
}

export { parseJsonArray };
