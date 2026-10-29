import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { UserRole } from '@/modules/auth/domain/entities/user.entity';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
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

const DISCUSSION_MODERATOR_ROLES: UserRole[] = [
  'reviewer',
  'admin',
  'root',
  'editor',
];

const SNIPPET_MAX = 80;
const PENDING_TITLE = 'Diskusi menunggu tinjauan';

function truncateSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
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
 * Edit OP yang sudah tayang (#202): body + link, lalu kembali `pending_review`
 * (pra-moderasi ulang - cegah sunting jadi SARA/seksual tanpa tinjauan).
 * Feed publik sembunyi sampai approve lagi. Tanpa activity event baru.
 */
export class UpdateDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
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

    const updated = await this.repo.updateDiscussionBodyWithRevision({
      discussionId: cmd.discussionId,
      editorId: cmd.actorId,
      body: filteredBody,
      bodyOriginal,
      linkUrl,
      requeuePendingReview: true,
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
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
        status: 'pending_review',
        body: filteredBody,
        body_original: bodyOriginal,
        link_url: linkUrl,
        censored: wasFiltered,
        requeued: true,
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

    await this.notifyModerators({
      discussionId: help.id,
      actorId: cmd.actorId,
      bodySnippet: filteredBody,
    });

    return updated;
  }

  private async notifyModerators(input: {
    discussionId: string;
    actorId: string;
    bodySnippet: string;
  }): Promise<void> {
    if (!this.userRepo || (!this.inbox && !this.notifyUser)) return;

    try {
      const moderatorIds = await this.userRepo.listActiveIdsByRoles(DISCUSSION_MODERATOR_ROLES);
      const recipients = moderatorIds.filter((id) => id !== input.actorId);
      if (recipients.length === 0) return;

      const snippet = truncateSnippet(input.bodySnippet);
      const body = snippet
        ? `Ada suntingan diskusi: "${snippet}"`
        : 'Ada suntingan diskusi yang menunggu pemeriksaan.';
      const title = PENDING_TITLE;

      for (const userId of recipients) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'discussion_pending_review',
            targetKind: 'discussion',
            targetId: input.discussionId,
            actorId: input.actorId,
            title,
            body,
            actionKind: 'discussion',
            actionValue: input.discussionId,
          });
        }
        if (this.notifyUser) {
          await this.notifyUser.execute({
            userId,
            title,
            body,
            actorId: input.actorId,
            data: {
              type: 'discussion_pending_review',
              target_kind: 'discussion',
              target_id: input.discussionId,
              action_kind: 'discussion',
              action_value: input.discussionId,
            },
          });
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'discussion edit requeue blast failed',
          discussion_id: input.discussionId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
