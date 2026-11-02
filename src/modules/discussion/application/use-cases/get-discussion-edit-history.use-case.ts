import { NotFoundError } from '@/shared/errors/app-error';
import type { DiscussionRevision } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface DiscussionEditHistoryResult {
  current: {
    body: string | null;
    link_url: string | null;
    updated_at: string | null;
    is_edited: boolean;
  };
  revisions: Array<{
    body: string;
    editor_id: string;
    created_at: string;
  }>;
}

/** Riwayat sunting OP (publik). Hanya saat status published - anti-bocor. */
export class GetDiscussionEditHistoryUseCase {
  constructor(private readonly repo: DiscussionRepository) {}

  async execute(discussionId: string): Promise<DiscussionEditHistoryResult> {
    const help = await this.repo.findById(discussionId);
    if (!help || help.status !== 'published') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const revisions = await this.repo.listDiscussionRevisions(discussionId);

    return {
      current: {
        body: help.body,
        link_url: help.linkUrl,
        updated_at: help.updatedAt?.toISOString() ?? null,
        is_edited: help.isEdited ?? revisions.length > 0,
      },
      revisions: revisions.map((rev) => this.toWireRevision(rev)),
    };
  }

  private toWireRevision(rev: DiscussionRevision) {
    return {
      body: rev.body,
      editor_id: rev.editorId,
      created_at: rev.createdAt.toISOString(),
    };
  }
}
