import { PENDING_WORD_IMAGE_PLACEHOLDER_URL } from '@/shared/constants/pending-word-image';

export interface WordImageUrlFields {
  url: string;
  provider?: string | null;
  isVerified?: boolean | null;
  providerFileId?: string | null;
  /** `jinye` = salinan foto Jinye (GitHub) yang belum lolos review. */
  sourceType?: string | null;
}

/**
 * Wire publik: staging ImageKit atau salinan foto Jinye yang belum
 * diverifikasi → placeholder.
 * Admin / antrean review memanggil dengan redact=false.
 */
export function mapPublicWordImageUrl(
  img: WordImageUrlFields,
  opts: { redactStaging: boolean },
): { url: string; providerFileId: string } {
  const staging =
    opts.redactStaging &&
    (img.provider === 'imagekit' || img.sourceType === 'jinye') &&
    img.isVerified !== true;

  if (!staging) {
    return { url: img.url, providerFileId: img.providerFileId ?? '' };
  }

  return {
    url: PENDING_WORD_IMAGE_PLACEHOLDER_URL,
    // Jangan bocorkan file id ImageKit ke klien publik
    providerFileId: '',
  };
}
