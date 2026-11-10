import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { jinyeFeedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import { RateLimitedError, ValidationError } from '@/shared/errors/app-error';
import type { Jinye, JinyeImage } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import { isJinyeCreateQuotaEnforced } from '../utils/jinye-quota';

const MAX_BODY = 500;
const MAX_IMAGES = 4;
const QUOTA_MS = 24 * 60 * 60 * 1000;

export interface CreateJinyeCommand {
  userId: string;
  body?: string | null;
  images?: JinyeImage[];
  /** Voice-only: create dulu, client segera POST /:id/audio. */
  hasPendingAudio?: boolean;
  requestId?: string | null;
}

export class CreateJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: Pick<
      CommentBlocklistRepository,
      'listAllActiveWords'
    >,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'jinye_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
        payload?: string | null;
      }) => Promise<void>;
    },
  ) {}

  async execute(cmd: CreateJinyeCommand): Promise<Jinye> {
    await assertCanContribute(cmd.userId);

    if (isJinyeCreateQuotaEnforced()) {
      const lastAt = await this.repo.findLatestCreatedAtByUser(cmd.userId);
      if (lastAt) {
        const elapsed = Date.now() - lastAt.getTime();
        if (elapsed < QUOTA_MS) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((QUOTA_MS - elapsed) / 1000),
          );
          const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
          throw new RateLimitedError(
            `Kamu sudah membuat Jinye dalam 24 jam terakhir. Coba lagi sekitar ${hours} jam lagi ya.`,
            retryAfterSeconds,
          );
        }
      }
    }

    let body = (cmd.body ?? '').trim();
    if (body.length > MAX_BODY) {
      throw new ValidationError([
        { field: 'body', message: `Teks maksimal ${MAX_BODY} karakter` },
      ]);
    }

    const images = (cmd.images ?? []).slice(0, MAX_IMAGES);
    if ((cmd.images?.length ?? 0) > MAX_IMAGES) {
      throw new ValidationError([
        { field: 'images', message: 'Lampiran tidak boleh lebih dari 4 foto' },
      ]);
    }
    for (const img of images) {
      if (!/^https?:\/\//i.test(img.url) || !img.providerFileId.trim()) {
        throw new ValidationError([
          {
            field: 'images',
            message: 'Foto tidak valid. Unggah ulang dari aplikasi ya.',
          },
        ]);
      }
    }

    if (!body && images.length === 0 && !cmd.hasPendingAudio) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Isi teks, foto, atau rekaman suara dulu ya.',
        },
      ]);
    }

    let bodyOriginal: string | null = null;
    if (body) {
      const quality = await assertUgcTextQualityWithStrike(body, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'jinye',
        requestId: cmd.requestId,
        field: 'body',
        minMeaningfulChars: 2,
      });
      const blocked = await this.blocklistRepo.listAllActiveWords();
      const filtered = applyBlocklistFilter(quality, blocked);
      if (filtered !== quality) {
        bodyOriginal = quality;
      }
      body = filtered;
    }

    const created = await this.repo.create({
      userId: cmd.userId,
      body,
      bodyOriginal,
      images: images.map((i) => ({
        url: i.url.trim(),
        providerFileId: i.providerFileId.trim(),
        publicUrl: null,
        contentWarnings: [],
      })),
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'jinye',
      entityId: created.id,
      newData: {
        status: created.status,
        has_images: created.images.length > 0,
        has_pending_audio: !!cmd.hasPendingAudio,
        body_len: created.body.length,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `jinye:${created.id}`,
      payload: jinyeFeedPayload({
        body: created.body,
        imageCount: created.images.length,
        hasAudio: !!cmd.hasPendingAudio,
      }),
    });

    return created;
  }
}
