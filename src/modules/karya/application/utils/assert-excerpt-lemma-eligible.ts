import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import {
  KARYA_EXCERPT_LEMMA_LINK_RIGHTS,
  type KaryaLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/karya-lemma-links.schema';
import type { KaryaExcerptRightsStatus } from '@/shared/database/drizzle/schema/karya-excerpts.schema';

export type KaryaExcerptLemmaContext = {
  id: string;
  text: string;
  publishStatus: string;
  deletedAt: Date | null;
  rightsStatus: KaryaExcerptRightsStatus;
  authorId: string | null;
  karyaId: string;
  karyaPublishStatus: string;
  karyaDeletedAt: Date | null;
};

const ALLOWED = new Set<string>(KARYA_EXCERPT_LEMMA_LINK_RIGHTS);

export function assertExcerptLemmaEligible(ctx: KaryaExcerptLemmaContext): void {
  if (
    ctx.deletedAt ||
    ctx.publishStatus !== 'published' ||
    ctx.karyaDeletedAt ||
    ctx.karyaPublishStatus !== 'published'
  ) {
    throw new NotFoundError(
      'KARYA_EXCERPT_NOT_FOUND',
      'Cuplikan tidak ditemukan atau belum tayang',
    );
  }
  if (
    ctx.rightsStatus === 'unknown' ||
    !ALLOWED.has(ctx.rightsStatus)
  ) {
    throw new ValidationError([
      {
        field: 'excerpt_id',
        message:
          'Tautan lemma belum bisa ditambah untuk cuplikan dengan hak unknown atau belum jelas',
      },
    ]);
  }
}

export function isPublicLemmaLinkStatus(status: KaryaLemmaLinkStatus): boolean {
  return status === 'active' || status === 'pending_correction';
}