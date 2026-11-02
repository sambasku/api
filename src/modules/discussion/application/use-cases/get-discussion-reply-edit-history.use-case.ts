import { NotFoundError } from '@/shared/errors/app-error';
import type { DiscussionReplyRevision } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionReplyEditHistoryResult {
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

/** Riwayat sunting balasan (publik). Non-published → 404 anti-bocor. */
export class GetDiscussionReplyEditHistoryUseCase {
  constructor(private readonly repo: DiscussionRepository) {}

  async execute(replyId: string): Promise<DiscussionReplyEditHistoryResult> {
    const reply = await this.repo.findReplyById(replyId);
    if (!reply || reply.status !== 'published') {
      throw new NotFoundError(
        'DISCUSSION_REPLY_NOT_FOUND',
        'Balasan tidak ditemukan',
      );
    }

    const revisions = await this.repo.listReplyRevisions(replyId);

    return {
      current: {
        body: this.publicBody(reply.body),
        updated_at: reply.updatedAt?.toISOString() ?? null,
        is_edited: reply.isEdited ?? revisions.length > 0,
      },
      revisions: revisions.map((rev) => this.toWireRevision(rev)),
    };
  }

  private publicBody(body: string): string | null {
    const trimmed = body.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toWireRevision(rev: DiscussionReplyRevision) {
    return {
      body: rev.body,
      editor_id: rev.editorId,
      created_at: rev.createdAt.toISOString(),
    };
  }
}
