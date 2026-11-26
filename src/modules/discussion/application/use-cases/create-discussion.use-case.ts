import { ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { discussionCreatedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type {
  NewDiscussion,
  Discussion,
  DiscussionImage,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import { promoteDiscussionImages } from '../utils/promote-discussion-images';

export interface CreateDiscussionCommand {
  userId: string;
  body: string;
  linkUrl?: string | null;
  images: DiscussionImage[];
  requestId?: string | null;
}

function normalizeLinkUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length > 2048) {
    throw new ValidationError([{ field: 'link_url', message: 'Tautan maksimal 2048 karakter' }]);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError([{ field: 'link_url', message: 'Tautan tidak valid' }]);
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError([
      { field: 'link_url', message: 'Tautan harus memakai https://' },
    ]);
  }
  return parsed.toString();
}

export class CreateDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly imageStorage: ImageStoragePort,
    private readonly activityEvents?: Pick<RecordActivityEventUseCase, 'safe'>,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'listAllActiveWords'>,
  ) {}

  async execute(cmd: CreateDiscussionCommand): Promise<Discussion> {
    await assertCanContribute(cmd.userId);

    const raw = cmd.body.trim();
    if (raw.length < 1) {
      throw new ValidationError([{ field: 'body', message: 'Deskripsi wajib diisi' }]);
    }
    if (raw.length > 1000) {
      throw new ValidationError([{ field: 'body', message: 'Deskripsi maksimal 1000 karakter' }]);
    }

    const quality = await assertUgcTextQualityWithStrike(raw, {
      userId: cmd.userId,
      abuse: this.abuse,
      entityType: 'discussion',
      requestId: cmd.requestId,
      field: 'body',
      minMeaningfulChars: 2,
    });
    const blocked = (await this.blocklist?.listAllActiveWords()) ?? [];
    const trimmed = applyBlocklistFilter(quality, blocked);
    if (isHeavyCensor(quality, trimmed)) {
      throw new ValidationError([
        { field: 'body', message: 'Deskripsi mengandung kata yang tidak pantas' },
      ]);
    }

    const linkUrl = normalizeLinkUrl(cmd.linkUrl);

    if (cmd.images.length > 4) {
      throw new ValidationError([
        { field: 'images', message: 'Lampiran tidak boleh lebih dari 4 gambar' },
      ]);
    }

    for (const img of cmd.images) {
      if (!/^https?:\/\//i.test(img.url)) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
      if (!img.providerFileId.trim()) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
    }

    const stagingImages: DiscussionImage[] = cmd.images.map((img) => ({
      url: img.url,
      providerFileId: img.providerFileId,
      publicUrl: null,
      contentWarnings: [],
    }));

    // Promote sebelum insert supaya create langsung published dengan public_url.
    const images =
      stagingImages.length > 0
        ? await promoteDiscussionImages({
            images: stagingImages,
            publicImageStorage: this.publicImageStorage,
            imageStorage: this.imageStorage,
          })
        : [];

    const input: NewDiscussion = {
      userId: cmd.userId,
      body: trimmed,
      linkUrl,
      images,
    };
    const row = await this.repo.create(input);

    await this.activityEvents?.safe({
      kind: 'discussion_created',
      actorId: cmd.userId,
      targetId: row.id,
      dedupeKey: `discussion:${row.id}`,
      payload: discussionCreatedPayload(trimmed),
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'discussion',
      entityId: row.id,
      newData: {
        status: row.status,
        image_count: images.length,
        has_body: true,
        has_link: linkUrl != null,
        promoted: images.some((i) => i.publicUrl != null),
      },
      requestId: cmd.requestId ?? null,
    });

    return row;
  }
}
