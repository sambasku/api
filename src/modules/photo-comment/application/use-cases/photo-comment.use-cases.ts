import {
  buildCommentEditHistoryWire,
  resolveCommentParentId,
} from '@/shared/comment/comment-threading';
import { prepareEntityCommentCreate } from '@/shared/comment/prepare-entity-comment-create';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { commentFeedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordCommentPushCooldownGate } from '@/modules/notification/application/use-cases/word-comment-push-cooldown-gate';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type {
  PhotoComment,
  PhotoCommentKind,
  ResolvedPhoto,
} from '../../domain/entities/photo-comment.entity';
import type {
  PhotoCommentRepository,
  PhotoResolver,
} from '../../domain/repositories/photo-comment.repository';

const SNIPPET_MAX = 80;
const PHOTO_COMMENT_TITLE = 'Foto kamu dikomentari';
const PHOTO_REPLY_TITLE = 'Komentarmu dibalas';

function truncateSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

/** Nilai `action_value` notifikasi: `<kind>:<hostKey>:<photoRef>` (hostKey = slug / id kata). */
export function photoNotificationActionValue(photo: ResolvedPhoto): string {
  return `${photo.kind}:${photo.hostKey}:${photo.ref}`;
}

export class ListPhotoCommentsUseCase {
  constructor(private readonly repo: PhotoCommentRepository) {}

  /** Tanpa resolve foto: ref tak dikenal = daftar kosong (hemat subrequest). */
  async execute(
    kind: PhotoCommentKind,
    ref: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<PhotoComment>> {
    return this.repo.listComments(kind, ref, {
      status: 'published',
      cursor,
      limit,
    });
  }

  async getEditHistory(commentId: string) {
    const comment = await this.repo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    const revisions = await this.repo.listCommentRevisions(commentId);
    return buildCommentEditHistoryWire(comment, revisions);
  }

  /** Satu query: jumlah komentar published per foto (badge galeri). */
  async countByPhotos(
    kind: PhotoCommentKind,
    refs: string[],
  ): Promise<Record<string, number>> {
    return this.repo.countByPhotos(kind, refs);
  }
}

export interface PhotoCommentNotifyDeps {
  userRepo?: UserRepository;
  inbox?: RecordInboxNotificationUseCase;
  notifyUser?: NotifyUserUseCase;
  pushCooldown?: WordCommentPushCooldownGate;
}

export class CreatePhotoCommentUseCase {
  constructor(
    private readonly repo: PhotoCommentRepository,
    private readonly photos: PhotoResolver,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly notify: PhotoCommentNotifyDeps = {},
  ) {}

  async execute(input: {
    kind: PhotoCommentKind;
    ref: string;
    parentId?: string | null;
    userId: string;
    body?: string;
    requestId?: string | null;
  }): Promise<PhotoComment> {
    await assertCanContribute(input.userId);
    const photo = await this.photos.resolve(input.kind, input.ref);
    if (!photo) {
      throw new NotFoundError(
        'PHOTO_NOT_FOUND',
        'Foto tidak ditemukan atau sudah tidak tayang',
      );
    }
    const prepared = await prepareEntityCommentCreate({
      userId: input.userId,
      requestId: input.requestId,
      entityType: 'photo_comment',
      body: input.body,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });
    const parentInfo: { authorId: string | null } = { authorId: null };
    const parentId = await resolveCommentParentId({
      rawParentId: input.parentId,
      hostId: photo.ref,
      findParent: async (id) => {
        const p = await this.repo.findCommentById(id);
        if (p) parentInfo.authorId = p.userId;
        return p
          ? { id: p.id, hostId: p.photoRef, parentId: p.parentId, status: p.status }
          : null;
      },
    });
    const created = await this.repo.createComment({
      photoKind: photo.kind,
      photoRef: photo.ref,
      hostId: photo.hostId,
      parentId,
      userId: input.userId,
      body: prepared.body,
      bodyOriginal: prepared.bodyOriginal,
    });
    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'photo_comment',
      entityId: created.id,
      newData: {
        photo_kind: photo.kind,
        photo_ref: photo.ref,
        host_id: photo.hostId,
      },
      requestId: input.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'photo_comment_created',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `photo_comment:${created.id}`,
      payload: commentFeedPayload({ body: created.body }),
    });
    await this.notifyParticipants({
      photo,
      actorId: input.userId,
      parentAuthorId: parentInfo.authorId,
      commentBody: created.body,
    });
    return created;
  }

  /**
   * Uploader foto dapat notif `photo_comment`; penulis komentar yang dibalas
   * dapat `photo_comment_reply` (tidak dobel bila dia juga uploader).
   * Foto stock / tanpa uploader dan komentar sendiri dilewati. Best-effort.
   */
  private async notifyParticipants(input: {
    photo: ResolvedPhoto;
    actorId: string;
    parentAuthorId: string | null;
    commentBody: string;
  }): Promise<void> {
    const { inbox, notifyUser, userRepo, pushCooldown } = this.notify;
    if (!inbox && !notifyUser) return;
    const recipients: Array<{ userId: string; reply: boolean }> = [];
    const uploader = input.photo.uploaderId;
    if (uploader && uploader !== input.actorId) {
      recipients.push({ userId: uploader, reply: false });
    }
    const parentAuthor = input.parentAuthorId;
    if (
      parentAuthor &&
      parentAuthor !== input.actorId &&
      parentAuthor !== uploader
    ) {
      recipients.push({ userId: parentAuthor, reply: true });
    }
    if (recipients.length === 0) return;

    try {
      let actorName = 'Seseorang';
      if (userRepo) {
        const actor = await userRepo.findById(input.actorId);
        if (actor) actorName = actor.displayName?.trim() || actor.username;
      }
      const snippet = truncateSnippet(input.commentBody);
      const actionValue = photoNotificationActionValue(input.photo);

      for (const r of recipients) {
        const type = r.reply ? 'photo_comment_reply' : 'photo_comment';
        const title = r.reply ? PHOTO_REPLY_TITLE : PHOTO_COMMENT_TITLE;
        const body = r.reply
          ? `${actorName} membalas komentarmu di foto "${input.photo.hostLabel}": ${snippet}`
          : `${actorName} mengomentari fotomu di "${input.photo.hostLabel}": ${snippet}`;
        if (inbox) {
          await inbox.execute({
            userId: r.userId,
            type,
            targetKind: 'photo',
            targetId: input.photo.ref,
            actorId: input.actorId,
            title,
            body,
            refreshOnConflict: true,
            actionKind: 'photo',
            actionValue,
          });
        }
        if (notifyUser) {
          const maySend = !pushCooldown || (await pushCooldown.maySend(r.userId));
          if (maySend) {
            await notifyUser.execute({
              userId: r.userId,
              title,
              body,
              actorId: input.actorId,
              data: {
                type,
                target_kind: 'photo',
                target_id: input.photo.ref,
                action_kind: 'photo',
                action_value: actionValue,
              },
            });
            await pushCooldown?.touchAfterSend(r.userId);
          }
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'photo comment notify failed',
          photo_kind: input.photo.kind,
          photo_ref: input.photo.ref,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

export class UpdatePhotoCommentUseCase {
  constructor(
    private readonly repo: PhotoCommentRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(input: {
    commentId: string;
    userId: string;
    body: string;
    requestId?: string | null;
  }): Promise<PhotoComment> {
    await assertCanContribute(input.userId);
    const existing = await this.repo.findCommentById(input.commentId);
    if (!existing || existing.status !== 'published') {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (existing.userId !== input.userId) {
      throw new ForbiddenError(
        'COMMENT_NOT_OWNER',
        'Kamu hanya bisa mengubah komentar sendiri',
      );
    }
    const body = input.body.trim();
    if (body.length === 0 || body.length > 1000) {
      throw new BadRequestError('VALIDATION_ERROR', 'Komentar 1-1000 karakter', [
        { field: 'body', message: 'Komentar antara 1 sampai 1000 karakter' },
      ]);
    }
    await assertUgcTextQualityWithStrike(body, {
      userId: input.userId,
      abuse: this.abuse,
      entityType: 'photo_comment',
      requestId: input.requestId,
    });
    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filtered = applyBlocklistFilter(body, blocked);
    const updated = await this.repo.updateCommentWithRevision({
      commentId: input.commentId,
      editorId: input.userId,
      body: filtered,
    });
    if (!updated) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: input.userId,
      action: 'update',
      entityType: 'photo_comment',
      entityId: input.commentId,
      requestId: input.requestId ?? null,
    });
    return updated;
  }
}

export class DeletePhotoCommentUseCase {
  constructor(private readonly repo: PhotoCommentRepository) {}
  async execute(commentId: string, userId: string): Promise<void> {
    const ok = await this.repo.markCommentDeletedByAuthor(commentId, userId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
  }
}

export class TakedownPhotoCommentUseCase {
  constructor(
    private readonly repo: PhotoCommentRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(commentId: string, actorId: string): Promise<void> {
    const ok = await this.repo.takedownComment(commentId, actorId);
    if (!ok) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: actorId,
      action: 'takedown',
      entityType: 'photo_comment',
      entityId: commentId,
    });
  }
}
