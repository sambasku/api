import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import { validateAudioFile } from '@/modules/word/application/utils/validate-audio-file';
import { generateId } from '@/shared/utils/ulid';
import { type RhymeScheme } from '../utils/rhyme-check';
import { assertPantunAudioDurationMs } from '../utils/pantun-audio-duration';
import { buildPantunReplyAudioPath } from '../utils/pantun-audio-path';
import type { PantunReply } from '../../domain/entities/pantun.entity';
import { CreatePantunReplyUseCase } from './create-pantun-reply.use-case';

export interface CreatePantunReplyWithAudioCommand {
  parentId: string;
  userId: string;
  /** Opsional: kosong = voice-only. */
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
 * Balas pantun dengan bacaan suara (atomik). Teks 4 baris opsional.
 */
export class CreatePantunReplyWithAudioUseCase {
  constructor(
    private readonly createReply: CreatePantunReplyUseCase,
    private readonly storage: PronunciationStoragePort,
  ) {}

  async execute(cmd: CreatePantunReplyWithAudioCommand): Promise<PantunReply> {
    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = assertPantunAudioDurationMs(cmd.durationMs);
    const replyId = generateId();
    const path = buildPantunReplyAudioPath({
      parentId: cmd.parentId,
      mimeType: file.mimeType,
    });

    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    return this.createReply.execute({
      id: replyId,
      parentId: cmd.parentId,
      userId: cmd.userId,
      lines: cmd.lines,
      rhymeScheme: cmd.rhymeScheme,
      categoryId: cmd.categoryId,
      language: cmd.language,
      requestId: cmd.requestId,
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
  }
}
