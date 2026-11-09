import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const MAX_BODY = 500;

/** Owner edit body Jinye (post-mod tetap published). Revisi + stale lemma links. */
export class UpdateJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: Pick<
      CommentBlocklistRepository,
      'listAllActiveWords'
    >,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    id: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<Jinye> {
    await assertCanContribute(input.userId);

    const row = await this.repo.findById(input.id);
    if (!row || row.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (row.userId !== input.userId) {
      throw new ForbiddenError(
        'NOT_OWNER',
        'Hanya penulis yang bisa mengedit Jinye ini',
      );
    }
    if (row.repostOfId && !row.quoteBody) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Repost polos tidak bisa diedit. Batalkan saja kalau salah.',
        },
      ]);
    }

    let body = input.body.trim();
    if (body.length > MAX_BODY) {
      throw new ValidationError([
        { field: 'body', message: `Teks maksimal ${MAX_BODY} karakter` },
      ]);
    }
    if (!body && !row.audio && row.images.length === 0) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Isi teks dulu ya, atau biarkan media yang sudah ada.',
        },
      ]);
    }

    let bodyOriginal: string | null = null;
    if (body) {
      const quality = await assertUgcTextQualityWithStrike(body, {
        userId: input.userId,
        abuse: this.abuse,
        entityType: 'jinye',
        requestId: input.requestId,
        field: 'body',
        minMeaningfulChars: 2,
      });
      const blocked = await this.blocklistRepo.listAllActiveWords();
      const filtered = applyBlocklistFilter(quality, blocked);
      if (filtered !== quality) bodyOriginal = quality;
      body = filtered;
    }

    const bodyChanged = row.body !== body;
    const updated = await this.repo.updateBody({
      id: input.id,
      editorId: input.userId,
      body,
      bodyOriginal,
    });
    if (!updated) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    if (bodyChanged) {
      await this.repo.markLemmaLinksStale(input.id);
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'jinye',
      entityId: input.id,
      oldData: { body_len: row.body.length },
      newData: { body_len: body.length, lemma_links_stale: bodyChanged },
      requestId: input.requestId ?? null,
    });

    return updated;
  }
}
