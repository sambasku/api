import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { type RhymeScheme } from '../../application/utils/rhyme-check';
import { preparePantunLines } from '../../application/utils/prepare-pantun-lines';
import type { NewPantun, Pantun } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface CreatePantunCommand {
  userId: string;
  lines: string[];
  /** Opsional: kosong = server deteksi sendiri (ABAB lalu AAAA). */
  rhymeScheme?: RhymeScheme | null;
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

    const { cleaned, scheme } = await preparePantunLines({
      lines: cmd.lines,
      rhymeScheme: cmd.rhymeScheme,
      userId: cmd.userId,
      entityType: 'pantun',
      requestId: cmd.requestId,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });

    const created = await this.repo.create({
      userId: cmd.userId,
      categoryId: cmd.categoryId ?? null,
      language: cmd.language?.trim() || 'id',
      rhymeScheme: scheme,
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
