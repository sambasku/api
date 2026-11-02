import { NotFoundError } from '@/shared/errors/app-error';
import type { PantunRhymeScheme } from '@/shared/database/drizzle/schema/pantun.schema';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';

export interface PantunReplyEditHistoryRevision {
  lines: string[];
  rhyme_scheme: PantunRhymeScheme;
  editor_id: string;
  created_at: string;
}

export interface PantunReplyEditHistoryResult {
  current: {
    lines: string[];
    rhyme_scheme: PantunRhymeScheme;
  };
  revisions: PantunReplyEditHistoryRevision[];
}

/** Riwayat sunting balasan (publik). Hanya balasan published. */
export class GetPantunReplyEditHistoryUseCase {
  constructor(private readonly repo: PantunRepository) {}

  async execute(replyId: string): Promise<PantunReplyEditHistoryResult> {
    const reply = await this.repo.findReplyById(replyId);
    if (!reply || reply.status !== 'published') {
      throw new NotFoundError('PANTUN_REPLY_NOT_FOUND', 'Balasan tidak ditemukan');
    }

    const revisions = await this.repo.listReplyRevisions(replyId);

    return {
      current: {
        lines: reply.lines,
        rhyme_scheme: reply.rhymeScheme,
      },
      revisions: revisions.map((r) => ({
        lines: r.lines,
        rhyme_scheme: r.rhymeScheme,
        editor_id: r.editorId,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
