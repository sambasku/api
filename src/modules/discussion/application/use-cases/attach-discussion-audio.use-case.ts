import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  clampDurationMs,
  validateAudioFile,
} from '@/modules/word/application/utils/validate-audio-file';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import { buildDiscussionReplyAudioPath } from '../utils/discussion-reply-audio-path';

export interface AttachDiscussionAudioCommand {
  discussionId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

/**
 * Lampirkan audio ke opening thread pending_review (owner only).
 * Storage sama balasan suara; wire publik mereadact sampai published.
 */
export class AttachDiscussionAudioUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: AttachDiscussionAudioCommand): Promise<Discussion> {
    await assertCanContribute(cmd.userId);

    const discussion = await this.repo.findById(cmd.discussionId);
    if (!discussion) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }
    if (discussion.userId !== cmd.userId) {
      throw new ForbiddenError('FORBIDDEN', 'Hanya pemilik yang boleh menambah audio');
    }
    if (discussion.status !== 'pending_review') {
      throw new ConflictError(
        'DISCUSSION_NOT_PENDING',
        'Audio hanya bisa dilampirkan saat diskusi menunggu pengecekan',
      );
    }

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = clampDurationMs(cmd.durationMs);

    const previous = discussion.audio;
    const path = buildDiscussionReplyAudioPath({
      discussionId: cmd.discussionId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const updated = await this.repo.setDiscussionAudio({
      id: cmd.discussionId,
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
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    if (previous?.providerFileId && previous.sha) {
      try {
        await this.storage.delete(previous.providerFileId, previous.sha);
      } catch {
        // best-effort
      }
    }

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'update',
      entityType: 'discussion',
      entityId: updated.id,
      newData: { has_audio: true, status: updated.status },
      requestId: cmd.requestId ?? null,
    });

    return updated;
  }
}
