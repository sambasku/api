import { ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { UserRole } from '@/modules/auth/domain/entities/user.entity';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
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

export interface CreateDiscussionCommand {
  userId: string;
  body: string;
  linkUrl?: string | null;
  images: DiscussionImage[];
  requestId?: string | null;
}

/** Role yang boleh moderasi Ruang Diskusi (parity admin-discussion.routes). */
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

export class CreateDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
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

    const input: NewDiscussion = {
      userId: cmd.userId,
      body: trimmed,
      linkUrl,
      images: cmd.images.map((img) => ({
        url: img.url,
        providerFileId: img.providerFileId,
        publicUrl: null,
        contentWarnings: [],
      })),
    };
    const row = await this.repo.create(input);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'discussion',
      entityId: row.id,
      newData: {
        status: row.status,
        image_count: cmd.images.length,
        has_body: true,
        has_link: linkUrl != null,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.notifyModerators({
      discussionId: row.id,
      actorId: cmd.userId,
      bodySnippet: trimmed,
    });

    return row;
  }

  /** Blast inbox + FCM ke verifikator (best-effort, tanpa cooldown). */
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
        ? `Ada diskusi baru: "${snippet}"`
        : 'Ada diskusi baru yang menunggu pemeriksaan.';
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
          msg: 'discussion pending_review blast failed',
          discussion_id: input.discussionId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
