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
import { prepareEntityCommentAudioCaption } from '@/shared/comment/prepare-entity-comment-create';
import type { UsahaComment } from '../../domain/entities/usaha.entity';
import type { UsahaRepository } from '../../domain/repositories/usaha.repository';

export interface CreateUsahaCommentAudioCommand {
  usahaId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  body?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

export class CreateUsahaCommentAudioUseCase {
  constructor(
    private readonly repo: UsahaRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: CreateUsahaCommentAudioCommand): Promise<UsahaComment> {
    await assertCanContribute(cmd.userId);
    const exists = await this.repo.usahaTargetExists(cmd.usahaId);
    if (!exists) {
      throw new NotFoundError(
        'USAHA_NOT_FOUND',
        'Usaha tidak ditemukan atau sudah tidak tayang',
      );
    }

    const { body, bodyOriginal } = await prepareEntityCommentAudioCaption({
      userId: cmd.userId,
      requestId: cmd.requestId,
      entityType: 'usaha_comment',
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
      kind: 'usaha',
      parentId: cmd.usahaId,
      mimeType: file.mimeType,
    });
    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const created = await this.repo.createComment({
      usahaId: cmd.usahaId,
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
      entityType: 'usaha_comment',
      entityId: created.id,
      newData: { usaha_id: cmd.usahaId, has_audio: true },
      requestId: cmd.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'usaha_comment_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `usaha_comment:${created.id}`,
      payload: commentFeedPayload({
        body: created.body,
        hasAudio: true,
      }),
    });
    return created;
  }
}