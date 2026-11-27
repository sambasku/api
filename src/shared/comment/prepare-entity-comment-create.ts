import { ValidationError } from '@/shared/errors/app-error';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { applyPiiPatternFilter } from '@/shared/moderation/apply-pii-pattern-filter';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { StickerRepository } from '@/modules/sticker/domain/repositories/sticker.repository';
import { resolveCommentStickerId } from './resolve-comment-sticker';

export interface PrepareEntityCommentCreateInput {
  userId: string;
  requestId?: string | null;
  entityType: string;
  body?: string | null;
  stickerId?: string | null;
  image?: { url: string; providerFileId: string } | null;
  stickerRepo?: StickerRepository;
  blocklistRepo: CommentBlocklistRepository;
  abuse?: RecordAbuseSignalUseCase;
}

export interface PreparedEntityCommentCreate {
  body: string;
  bodyOriginal: string | null;
  stickerId: string | null;
  image: { url: string; provider: string; providerFileId: string } | null;
}

export async function prepareEntityCommentCreate(
  input: PrepareEntityCommentCreateInput,
): Promise<PreparedEntityCommentCreate> {
  const rawBody = input.body?.trim() ?? '';
  const hasImage = Boolean(input.image?.url && input.image?.providerFileId);
  const rawSticker = input.stickerId?.trim() ?? '';
  if (rawSticker && hasImage) {
    throw new ValidationError([
      { field: 'sticker_id', message: 'Stiker tidak bisa digabung dengan foto' },
    ]);
  }
  const stickerId = await resolveCommentStickerId({
    rawStickerId: rawSticker || null,
    userId: input.userId,
    stickerRepo: input.stickerRepo,
  });
  if (rawBody.length === 0 && !hasImage && !stickerId) {
    throw new ValidationError([
      { field: 'body', message: 'Komentar, foto, atau stiker wajib diisi' },
    ]);
  }
  if (rawBody.length > 1000) {
    throw new ValidationError([
      { field: 'body', message: 'Komentar maksimal 1000 karakter' },
    ]);
  }

  let body = rawBody;
  if (rawBody.length > 0) {
    body = await assertUgcTextQualityWithStrike(rawBody, {
      userId: input.userId,
      abuse: input.abuse,
      entityType: input.entityType,
      requestId: input.requestId,
      minMeaningfulChars: 1,
    });
  }

  const blocked = await input.blocklistRepo.listAllActiveWords();
  const filtered =
    body.length > 0
      ? applyBlocklistFilter(applyPiiPatternFilter(body), blocked)
      : '';
  const bodyOriginal = body.length > 0 && filtered !== body ? body : null;

  return {
    body: filtered,
    bodyOriginal,
    stickerId,
    image: hasImage
      ? {
          url: input.image!.url,
          provider: 'imagekit',
          providerFileId: input.image!.providerFileId,
        }
      : null,
  };
}

export async function prepareEntityCommentAudioCaption(input: {
  userId: string;
  requestId?: string | null;
  entityType: string;
  body?: string | null;
  blocklistRepo: CommentBlocklistRepository;
  abuse?: RecordAbuseSignalUseCase;
}): Promise<{ body: string; bodyOriginal: string | null }> {
  const rawBody = (input.body ?? '').trim();
  if (rawBody.length > 1000) {
    throw new ValidationError([
      { field: 'body', message: 'Komentar maksimal 1000 karakter' },
    ]);
  }
  let caption = '';
  if (rawBody.length > 0) {
    caption = await assertUgcTextQualityWithStrike(rawBody, {
      userId: input.userId,
      abuse: input.abuse,
      entityType: input.entityType,
      requestId: input.requestId,
    });
  }
  let filteredBody = '';
  let bodyOriginal: string | null = null;
  if (caption.length > 0) {
    const blocked = await input.blocklistRepo.listAllActiveWords();
    filteredBody = applyBlocklistFilter(applyPiiPatternFilter(caption), blocked);
    bodyOriginal = filteredBody !== caption ? caption : null;
  }
  return { body: filteredBody, bodyOriginal };
}