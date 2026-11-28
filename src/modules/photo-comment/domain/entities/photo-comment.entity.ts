import type {
  PhotoCommentKind,
  PhotoCommentStatus,
} from '@/shared/database/drizzle/schema/photo-comments.schema';

export type { PhotoCommentKind, PhotoCommentStatus };

export interface PhotoComment {
  id: string;
  photoKind: PhotoCommentKind;
  photoRef: string;
  hostId: string;
  parentId: string | null;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  authorDeletedAt: Date | null;
  body: string;
  status: PhotoCommentStatus;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  replies?: PhotoComment[];
}

/** Hasil resolve foto: identitas host + pengunggah (null = stock / tak dikenal). */
export interface ResolvedPhoto {
  kind: PhotoCommentKind;
  ref: string;
  hostId: string;
  /** Slug host (wisata/usaha/kuliner/acara); id kata untuk lemma. Untuk deep link. */
  hostKey: string;
  hostLabel: string;
  uploaderId: string | null;
}
