import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { jinyeFeedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import {
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import { isJinyeCreateQuotaEnforced } from '../utils/jinye-quota';

const MAX_BODY = 500;
const QUOTA_MS = 24 * 60 * 60 * 1000;

/** Quote-repost: caption wajib, makan kuota create 1/24 jam, depth 1. */
export class QuoteJinyeUseCase {
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
        kind: 'jinye_quote_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
        payload?: string | null;
      }) => Promise<void>;
    },
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    quoteBody: string;
    requestId?: string | null;
  }): Promise<Jinye> {
    await assertCanContribute(input.userId);

    if (isJinyeCreateQuotaEnforced()) {
      const lastAt =
        await this.repo.findLatestQuotaConsumingCreatedAtByUser(input.userId);
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

    const original = await this.repo.findById(input.jinyeId);
    if (!original || original.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (original.repostOfId) {
      throw new ValidationError([
        {
          field: 'id',
          message: 'Tidak bisa mengutip konten yang sudah berupa repost/quote.',
        },
      ]);
    }

    let quoteBody = input.quoteBody.trim();
    if (!quoteBody) {
      throw new ValidationError([
        { field: 'quote_body', message: 'Tulis kutipan dulu ya.' },
      ]);
    }
    if (quoteBody.length > MAX_BODY) {
      throw new ValidationError([
        {
          field: 'quote_body',
          message: `Kutipan maksimal ${MAX_BODY} karakter`,
        },
      ]);
    }

    const quality = await assertUgcTextQualityWithStrike(quoteBody, {
      userId: input.userId,
      abuse: this.abuse,
      entityType: 'jinye',
      requestId: input.requestId,
      field: 'quote_body',
      minMeaningfulChars: 2,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    quoteBody = applyBlocklistFilter(quality, blocked);

    const created = await this.repo.create({
      userId: input.userId,
      body: '',
      images: [],
      repostOfId: original.id,
      quoteBody,
    });
    await this.repo.adjustRepostCount(original.id, 1);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'jinye',
      entityId: created.id,
      newData: { kind: 'quote', original_id: original.id },
      requestId: input.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_quote_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `jinye_quote:${created.id}`,
      payload: jinyeFeedPayload({ quoteBody: created.quoteBody ?? quoteBody }),
    });

    return created;
  }
}
