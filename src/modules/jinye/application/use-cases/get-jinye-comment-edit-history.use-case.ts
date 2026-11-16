import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export interface JinyeCommentEditHistoryResult {
  current: {
    body: string;
    updated_at: string | null;
    is_edited: boolean;
  };
  revisions: Array<{
    body: string;
    editor_id: string;
    created_at: string;
  }>;
}

/** Riwayat sunting komen Jinye (publik, hanya published). */
export class GetJinyeCommentEditHistoryUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(cmd: {
    jinyeId: string;
    commentId: string;
  }): Promise<JinyeCommentEditHistoryResult> {
    const row = await this.repo.findCommentById(cmd.commentId);
    if (
      !row ||
      row.jinyeId !== cmd.jinyeId ||
      row.status !== 'published'
    ) {
      throw new NotFoundError(
        'JINYE_COMMENT_NOT_FOUND',
        'Komentar tidak ditemukan',
      );
    }
    const revisions = await this.repo.listCommentRevisions(cmd.commentId);
    return {
      current: {
        body: row.body,
        updated_at: row.updatedAt?.toISOString() ?? null,
        is_edited: row.isEdited === true || revisions.length > 0,
      },
      revisions: revisions.map((r) => ({
        body: r.body,
        editor_id: r.editorId,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
