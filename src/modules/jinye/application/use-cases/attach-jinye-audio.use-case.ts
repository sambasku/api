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
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import { buildJinyeAudioPath } from '../utils/jinye-audio-path';

export interface AttachJinyeAudioCommand {
  jinyeId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

/**
 * Lampirkan / ganti voice note OP (owner). Jinye sudah published - audio
 * tayang langsung (beda diskusi yang pending_review).
 */
export class AttachJinyeAudioUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: AttachJinyeAudioCommand): Promise<Jinye> {
    await assertCanContribute(cmd.userId);

    const existing = await this.repo.findById(cmd.jinyeId);
    if (!existing) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (existing.userId !== cmd.userId) {
      throw new ForbiddenError('FORBIDDEN', 'Hanya pemilik yang boleh menambah audio');
    }
    if (existing.status !== 'published' && existing.status !== 'archived') {
      throw new ConflictError(
        'JINYE_NOT_EDITABLE',
        'Audio hanya bisa dilampirkan ke Jinye yang masih ada',
      );
    }

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = clampDurationMs(cmd.durationMs);
    const previous = existing.audio;

    const path = buildJinyeAudioPath({
      jinyeId: cmd.jinyeId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const updated = await this.repo.setAudio({
      id: cmd.jinyeId,
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
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
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
      entityType: 'jinye',
      entityId: cmd.jinyeId,
      newData: {
        has_audio: true,
        audio_duration_ms: durationMs,
      },
      requestId: cmd.requestId ?? null,
    });

    return updated;
  }
}
