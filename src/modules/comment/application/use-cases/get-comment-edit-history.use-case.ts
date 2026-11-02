import { NotFoundError } from '@/shared/errors/app-error';
import type { CommentRevision } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface CommentEditHistoryResult {
  current: {
    body: string | null;
    updated_at: string | null;
    is_edited: boolean;
  };
  revisions: Array<{
    body: string;
    editor_id: string;
    created_at: string;
  }>;
}

/** Riwayat sunting komentar (publik). Non-published → 404 anti-bocor. */
export class GetCommentEditHistoryUseCase {
  constructor(private readonly commentRepo: CommentRepository) {}

  async execute(commentId: string): Promise<CommentEditHistoryResult> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment || comment.status !== 'published') {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }

    const revisions = await this.commentRepo.listRevisions(commentId);

    return {
      current: {
        body: this.publicBody(comment.body),
        updated_at: comment.updatedAt?.toISOString() ?? null,
        is_edited: comment.isEdited ?? revisions.length > 0,
      },
      revisions: revisions.map((rev) => this.toWireRevision(rev)),
    };
  }

  private publicBody(body: string): string | null {
    const trimmed = body.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toWireRevision(rev: CommentRevision) {
    return {
      body: rev.body,
      editor_id: rev.editorId,
      created_at: rev.createdAt.toISOString(),
    };
  }
}
