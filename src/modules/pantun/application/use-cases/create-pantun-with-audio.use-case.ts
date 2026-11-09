import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import { validateAudioFile } from '@/modules/word/application/utils/validate-audio-file';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { generateId } from '@/shared/utils/ulid';
import { type RhymeScheme } from '../utils/rhyme-check';
import { prepareOptionalPantunLines } from '../utils/prepare-pantun-lines';
import { assertPantunAudioDurationMs } from '../utils/pantun-audio-duration';
import { buildPantunAudioPath } from '../utils/pantun-audio-path';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface CreatePantunWithAudioCommand {
  userId: string;
  /** Opsional: kosong = voice-only. Kalau diisi harus 4 baris berima. */
  lines?: string[] | null;
  rhymeScheme?: RhymeScheme | null;
  categoryId?: string | null;
  language?: string | null;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

/**
 * Kirim pantun suara (atomik, post-moderation).
 * Audio 10-60 detik wajib. Teks 4 baris opsional.
 */
export class CreatePantunWithAudioUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'pantun_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
      }) => Promise<void>;
    },
  ) {}

  async execute(cmd: CreatePantunWithAudioCommand): Promise<Pantun> {
    await assertCanContribute(cmd.userId);

    const { cleaned, scheme, voiceOnly } = await prepareOptionalPantunLines({
      lines: cmd.lines,
      rhymeScheme: cmd.rhymeScheme,
      userId: cmd.userId,
      entityType: 'pantun',
      requestId: cmd.requestId,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = assertPantunAudioDurationMs(cmd.durationMs);
    const pantunId = generateId();
    const path = buildPantunAudioPath({
      pantunId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const created = await this.repo.create({
      id: pantunId,
      userId: cmd.userId,
      categoryId: cmd.categoryId ?? null,
      language: cmd.language?.trim() || 'id',
      rhymeScheme: scheme,
      lines: cleaned,
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
      entityType: 'pantun',
      entityId: created.id,
      newData: {
        rhyme_scheme: voiceOnly ? null : created.rhymeScheme,
        status: created.status,
        has_audio: true,
        voice_only: voiceOnly,
        audio_duration_ms: durationMs,
      },
      requestId: cmd.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'pantun_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `pantun:${created.id}`,
    });
    return created;
  }
}
