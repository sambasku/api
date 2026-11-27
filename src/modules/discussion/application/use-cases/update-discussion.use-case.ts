import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { discussionCreatedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface UpdateDiscussionCommand {
  discussionId: string;
  actorId: string;
  body: string;
  /** undefined = biarkan tautan lama; null/'' = hapus; string = set https. */
  linkUrl?: string | null;
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

/**
 * Edit OP yang sudah tayang (#202 + #338): body + link, tetap `published`
 * (pasca-moderasi, sama create). Snapshot revision bila body berubah.
 * Payload activity di-update (dedupe key sama); `occurred_at` beku.
 */
export class UpdateDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: Pick<RecordActivityEventUseCase, 'safe'>,
  ) {}

  async execute(cmd: UpdateDiscussionCommand): Promise<Discussion> {
    await assertCanContribute(cmd.actorId);

    const help = await this.repo.findById(cmd.discussionId);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (help.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat mengedit diskusi ini.',
      );
    }

    if (help.status !== 'published') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const raw = cmd.body.trim();
    if (raw.length < 1) {
      throw new ValidationError([{ field: 'body', message: 'Deskripsi wajib diisi' }]);
    }
    if (raw.length > 1000) {
      throw new ValidationError([{ field: 'body', message: 'Deskripsi maksimal 1000 karakter' }]);
    }

    const quality = await assertUgcTextQualityWithStrike(raw, {
      userId: cmd.actorId,
      abuse: this.abuse,
      entityType: 'discussion',
      requestId: cmd.requestId,
      field: 'body',
      minMeaningfulChars: 2,
    });

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(quality, blocked);
    const wasFiltered = filteredBody !== quality;
    const bodyOriginal = wasFiltered ? quality : null;
    const linkUrl =
      cmd.linkUrl === undefined ? (help.linkUrl ?? null) : normalizeLinkUrl(cmd.linkUrl);

    const bodyChanged = (help.body ?? '') !== filteredBody;

    const updated = await this.repo.updateDiscussionBodyWithRevision({
      discussionId: cmd.discussionId,
      editorId: cmd.actorId,
      body: filteredBody,
      bodyOriginal,
      linkUrl,
      requeuePendingReview: false,
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (bodyChanged) {
      await this.repo.markLemmaLinksStale(cmd.discussionId);
      // Feed cuplikan mengikuti teks terbaru; waktu kejadian tetap beku.
      await this.activityEvents?.safe({
        kind: 'discussion_created',
        actorId: help.userId,
        targetId: help.id,
        dedupeKey: `discussion:${help.id}`,
        payload: discussionCreatedPayload(filteredBody),
      });
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'discussion',
      entityId: help.id,
      oldData: {
        status: help.status,
        body: help.body,
        body_original: help.bodyOriginal,
        link_url: help.linkUrl,
      },
      newData: {
        status: 'published',
        body: filteredBody,
        body_original: bodyOriginal,
        link_url: linkUrl,
        censored: wasFiltered,
        requeued: false,
      },
      requestId: cmd.requestId ?? null,
    });

    if (wasFiltered && quality.length > 0 && isHeavyCensor(quality, filteredBody)) {
      await safeRecordAbuseSignal(this.abuse, {
        userId: cmd.actorId,
        signal: 'heavy_censor',
        entityType: 'discussion',
        entityId: help.id,
        requestId: cmd.requestId,
      });
    }

    return updated;
  }
}
