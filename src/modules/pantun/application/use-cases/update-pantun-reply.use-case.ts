import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { type RhymeScheme } from '../../application/utils/rhyme-check';
import { resolveRhymeScheme } from '../../application/utils/resolve-rhyme';
import type { PantunReply } from '../../domain/entities/pantun.entity';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface UpdatePantunReplyCommand {
  replyId: string;
  actorId: string;
  lines: string[];
  rhymeScheme?: RhymeScheme | null;
  requestId?: string | null;
}

function pantunLinesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Edit balasan pantun (author-only, published). Tanpa activity event / notify. */
export class UpdatePantunReplyUseCase {
  constructor(
    private readonly repo: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async execute(cmd: UpdatePantunReplyCommand): Promise<PantunReply> {
    await assertCanContribute(cmd.actorId);

    const reply = await this.repo.findReplyById(cmd.replyId);
    if (!reply || reply.status !== 'published') {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
    }
    if (reply.userId !== cmd.actorId) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Hanya penulis yang dapat mengedit balasan ini. Verifikator memakai takedown.',
      );
    }

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
    const scheme = resolveRhymeScheme(cleaned, cmd.rhymeScheme);
    void (await assertUgcTextQualityWithStrike(joined, {
      userId: cmd.actorId,
      abuse: this.abuse,
      entityType: 'pantun_reply',
      requestId: cmd.requestId,
    }));

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

    if (reply.rhymeScheme === scheme && pantunLinesEqual(reply.lines, cleaned)) {
      return reply;
    }

    const updated = await this.repo.updateReplyWithRevision({
      replyId: cmd.replyId,
      editorId: cmd.actorId,
      rhymeScheme: scheme,
      lines: cleaned,
      previousRhymeScheme: reply.rhymeScheme,
      previousLines: reply.lines,
    });
    if (!updated) {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'pantun_reply',
      entityId: cmd.replyId,
      oldData: { rhyme_scheme: reply.rhymeScheme, lines: reply.lines },
      newData: { rhyme_scheme: scheme, lines: cleaned },
      requestId: cmd.requestId ?? null,
    });

    return updated;
  }
}
