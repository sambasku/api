import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  clampDurationMs,
  validateAudioFile,
} from '@/modules/word/application/utils/validate-audio-file';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { commentFeedPayload } from '@/modules/activity/application/utils/activity-body-snippet';
import { buildEntityCommentAudioPath } from '@/shared/comment/build-entity-comment-audio-path';
import { resolveCommentParentId } from '@/shared/comment/comment-threading';
import { prepareEntityCommentAudioCaption } from '@/shared/comment/prepare-entity-comment-create';
import type { JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export interface CreateJinyeCommentAudioCommand {
  jinyeId: string;
  parentId?: string | null;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  body?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

export class CreateJinyeCommentAudioUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: CreateJinyeCommentAudioCommand): Promise<JinyeComment> {
    await assertCanContribute(cmd.userId);

    const post = await this.repo.findById(cmd.jinyeId);
    if (!post || post.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const parentId = await resolveCommentParentId({
      rawParentId: cmd.parentId,
      hostId: cmd.jinyeId,
      findParent: async (id) => {
        const p = await this.repo.findCommentById(id);
        return p
          ? { id: p.id, hostId: p.jinyeId, parentId: p.parentId, status: p.status }
          : null;
      },
    });

    const { body, bodyOriginal } = await prepareEntityCommentAudioCaption({
      userId: cmd.userId,
      requestId: cmd.requestId,
      entityType: 'jinye_comment',
      body: cmd.body,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = clampDurationMs(cmd.durationMs);

    const path = buildEntityCommentAudioPath({
      kind: 'jinye',
      parentId: cmd.jinyeId,
      mimeType: file.mimeType,
    });
    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const created = await this.repo.createComment({
      jinyeId: cmd.jinyeId,
      parentId,
      userId: cmd.userId,
      body,
      bodyOriginal,
      audio: {
        url: uploaded.url,
        mimeType: file.mimeType,
        fileSize: uploaded.size,
        durationMs,
        provider: this.storage.providerName,
        providerFileId: uploaded.path,
        sha: uploaded.sha,
      },
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'jinye_comment',
      entityId: created.id,
      newData: { jinye_id: cmd.jinyeId, parent_id: parentId, has_audio: true },
      requestId: cmd.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_comment_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `jinye_comment:${created.id}`,
      payload: commentFeedPayload({
        body: created.body,
        hasAudio: true,
      }),
    });

    return created;
  }
}
