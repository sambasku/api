import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { JinyeComment, JinyeImage } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const MAX_BODY = 500;
const MAX_IMAGES = 4;
const SNIPPET_MAX = 80;
const REPLY_TITLE = 'Balasan Jinye baru';

function truncateSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

export interface CreateJinyeCommentCommand {
  jinyeId: string;
  userId: string;
  body?: string | null;
  parentId?: string | null;
  images?: JinyeImage[];
  requestId?: string | null;
}

export class CreateJinyeCommentUseCase {
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
        kind: 'jinye_comment_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
      }) => Promise<void>;
    },
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
  ) {}

  async execute(cmd: CreateJinyeCommentCommand): Promise<JinyeComment> {
    await assertCanContribute(cmd.userId);

    const jinye = await this.repo.findById(cmd.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    let parentId: string | null = cmd.parentId?.trim() || null;
    let parentAuthorId: string | null = null;
    if (parentId) {
      const parent = await this.repo.findCommentById(parentId);
      if (
        !parent ||
        parent.jinyeId !== cmd.jinyeId ||
        parent.status !== 'published'
      ) {
        throw new NotFoundError(
          'JINYE_COMMENT_NOT_FOUND',
          'Komentar induk tidak ditemukan',
        );
      }
      if (parent.parentId) {
        throw new ValidationError([
          {
            field: 'parent_id',
            message: 'Balasan hanya 1 tingkat. Balas ke komentar utama saja ya.',
          },
        ]);
      }
      parentAuthorId = parent.userId;
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

    if (!body && images.length === 0) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Isi teks atau foto dulu ya.',
        },
      ]);
    }

    let bodyOriginal: string | null = null;
    if (body) {
      const quality = await assertUgcTextQualityWithStrike(body, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'jinye_comment',
        requestId: cmd.requestId,
        field: 'body',
        minMeaningfulChars: 1,
      });
      const blocked = await this.blocklistRepo.listAllActiveWords();
      const filtered = applyBlocklistFilter(quality, blocked);
      if (filtered !== quality) {
        bodyOriginal = quality;
      }
      body = filtered;
    }

    const created = await this.repo.createComment({
      jinyeId: cmd.jinyeId,
      parentId,
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

    await this.repo.incrementPublishedCommentCount(cmd.jinyeId, 1);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'jinye_comment',
      entityId: created.id,
      newData: {
        jinye_id: cmd.jinyeId,
        parent_id: parentId,
        has_images: created.images.length > 0,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_comment_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `jinye_comment:${created.id}`,
    });

    await this.notifyRecipients({
      jinyeId: cmd.jinyeId,
      jinyeOwnerId: jinye.userId,
      jinyeBody: jinye.body,
      parentAuthorId,
      actorId: cmd.userId,
      commentBody: created.body || (created.images.length > 0 ? 'Foto' : ''),
    });

    return created;
  }

  /** Best-effort: owner Jinye + penulis komen induk (kalau reply). */
  private async notifyRecipients(input: {
    jinyeId: string;
    jinyeOwnerId: string;
    jinyeBody: string;
    parentAuthorId: string | null;
    actorId: string;
    commentBody: string;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      let actorName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(input.actorId);
        if (actor) actorName = actor.displayName?.trim() || actor.username;
      }

      const topic = truncateSnippet(input.jinyeBody || 'Jinye');
      const snippet = truncateSnippet(input.commentBody || 'Balasan baru');
      const body = `${actorName} membalas di "${topic}": ${snippet}`;

      const recipients = new Set<string>();
      if (input.jinyeOwnerId !== input.actorId) {
        recipients.add(input.jinyeOwnerId);
      }
      if (
        input.parentAuthorId &&
        input.parentAuthorId !== input.actorId &&
        input.parentAuthorId !== input.jinyeOwnerId
      ) {
        recipients.add(input.parentAuthorId);
      }

      for (const userId of recipients) {
        if (this.inbox) {
          await this.inbox.execute({
            userId,
            type: 'jinye_comment',
            targetKind: 'jinye',
            targetId: input.jinyeId,
            actorId: input.actorId,
            title: REPLY_TITLE,
            body,
            refreshOnConflict: true,
            actionKind: 'jinye',
            actionValue: input.jinyeId,
          });
        }
        if (this.notifyUser) {
          await this.notifyUser.execute({
            userId,
            title: REPLY_TITLE,
            body,
            actorId: input.actorId,
            data: {
              type: 'jinye_comment',
              target_kind: 'jinye',
              target_id: input.jinyeId,
              action_kind: 'jinye',
              action_value: input.jinyeId,
            },
          });
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'jinye comment notify failed',
          err: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
