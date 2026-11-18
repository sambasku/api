import type { CommentAudio, CommentImage } from '@/modules/comment/domain/entities/comment.entity';
import { IMAGE_CONTENT_WARNINGS } from '@/shared/constants/image-content-warnings';

export type EntityCommentPublishedStatus =
  | 'published'
  | 'taken_down'
  | 'deleted_by_author';

export function redactEntityCommentAudio(input: {
  status: EntityCommentPublishedStatus;
  audio: CommentAudio | null;
}): {
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duration_ms: number | null;
} {
  if (input.status !== 'published' || !input.audio) {
    return {
      audio_url: null,
      audio_mime_type: null,
      audio_duration_ms: null,
    };
  }
  return {
    audio_url: input.audio.url,
    audio_mime_type: input.audio.mimeType,
    audio_duration_ms: input.audio.durationMs,
  };
}

export function redactEntityCommentImage(input: {
  status: EntityCommentPublishedStatus;
  image: CommentImage | null;
}) {
  if (input.status !== 'published' || !input.image) return null;
  const img = input.image;
  if (img.status === 'published') {
    return {
      status: 'published' as const,
      public_url: img.publicUrl,
      content_warnings: img.contentWarnings.filter(
        (w): w is (typeof IMAGE_CONTENT_WARNINGS)[number] =>
          (IMAGE_CONTENT_WARNINGS as readonly string[]).includes(w),
      ),
    };
  }
  if (img.status === 'pending_review') {
    return {
      status: 'pending_review' as const,
      public_url: null,
      content_warnings: [] as (typeof IMAGE_CONTENT_WARNINGS)[number][],
    };
  }
  return null;
}

export function entityCommentMediaWireFields(input: {
  status: EntityCommentPublishedStatus;
  body: string;
  stickerId: string | null;
  audio: CommentAudio | null;
  image: CommentImage | null;
}) {
  return {
    body: input.status === 'published' ? input.body : input.body,
    sticker_id: input.stickerId,
    ...redactEntityCommentAudio({ status: input.status, audio: input.audio }),
    image: redactEntityCommentImage({ status: input.status, image: input.image }),
  };
}