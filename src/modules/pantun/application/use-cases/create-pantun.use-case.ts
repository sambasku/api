import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { ValidationError } from '@/shared/errors/app-error';
import {
  detectRhyme,
  type RhymeScheme,
} from '../../application/utils/rhyme-check';
import type { NewPantun, Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface CreatePantunCommand {
  userId: string;
  lines: string[];
  rhymeScheme: RhymeScheme;
  categoryId?: string | null;
  language?: string | null;
  requestId?: string | null;
}

/**
 * Kirim pantun 4 baris (post-moderation: langsung published).
 * Struktur (4 baris, tanpa baris kosong) + pola rima divalidasi server;
 * rima ambigu tetap diterima dengan warning, bukan ditolak.
 */
export class CreatePantunUseCase {
  constructor(
    private readonly repo: PantunRepository,
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

  async execute(cmd: CreatePantunCommand): Promise<Pantun> {
    await assertCanContribute(cmd.userId);

    if (cmd.lines.length !== 4) {
      throw new ValidationError([
        { field: 'lines', message: 'Pantun harus terdiri dari 4 baris' },
      ]);
    }
    const cleaned = cmd.lines.map((l) => l.trim().replace(/\s+/g, ' '));
    if (cleaned.some((l) => l.length === 0)) {
      throw new ValidationError([
        { field: 'lines', message: 'Ada baris kosong. Lengkapi keempat barisnya ya.' },
      ]);
    }
    const joined = cleaned.join('\n');
    if (joined.length > 600) {
      throw new ValidationError([
        { field: 'lines', message: 'Total isi pantun maksimal 600 karakter' },
      ]);
    }
    const check = detectRhyme(cleaned, cmd.rhymeScheme);
    if (!check.ok) {
      if (check.reason === 'LAST_WORD_UNDETECTED') {
        throw new ValidationError([
          {
            field: `lines[${check.lineIndex}]`,
            message: 'Kata akhir baris ini tidak terdeteksi. Perbaiki ya.',
          },
        ]);
      }
      const pairs = check.pairs.map(([a, b]) => `baris ${a} & ${b}`).join(', ');
      throw new ValidationError([
        {
          field: 'lines',
          message: `Pola rima ${cmd.rhymeScheme} belum pas: ${pairs} belum berima.`,
        },
      ]);
    }
    // Rima ambigu (suffix pendek): diterima, warning diteruskan ke caller
    // lewat field opsional - tidak memblokir kontribusi.
    const qualityBody = await assertUgcTextQualityWithStrike(joined, {
      userId: cmd.userId,
      abuse: this.abuse,
      entityType: 'pantun',
      requestId: cmd.requestId,
    });
    void qualityBody;

    const activeWords = await this.blocklistRepo.listAllActiveWords();
    const lowerLines = cleaned.map((l) => l.toLowerCase());
    for (const w of activeWords) {
      const word = w.toLowerCase();
      if (lowerLines.some((l) => l.includes(word))) {
        throw new ValidationError([
          { field: 'lines', message: 'Isi pantun mengandung kata yang tidak boleh dipakai' },
        ]);
      }
    }

    const created = await this.repo.create({
      userId: cmd.userId,
      categoryId: cmd.categoryId ?? null,
      language: cmd.language?.trim() || 'id',
      rhymeScheme: cmd.rhymeScheme,
      lines: cleaned,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'pantun',
      entityId: created.id,
      newData: { rhyme_scheme: created.rhymeScheme, status: created.status },
      requestId: cmd.requestId ?? null,
    });
    // Event feed: pantun tayang (post-moderation = momen create).
    await this.activityEvents?.safe({
      kind: 'pantun_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `pantun:${created.id}`,
    });
    return created;
  }
}

export type { NewPantun };
