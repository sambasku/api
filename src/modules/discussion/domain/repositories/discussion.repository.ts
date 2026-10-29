import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewDiscussion,
  NewDiscussionReply,
  Discussion,
  DiscussionImage,
  DiscussionListFilter,
  DiscussionReply,
  DiscussionReplyAudio,
  DiscussionReplyRevision,
  DiscussionStatus,
} from '../entities/discussion.entity';

export interface DiscussionRepository {
  create(input: NewDiscussion): Promise<Discussion>;
  findById(id: string): Promise<Discussion | null>;
  list(filter: DiscussionListFilter): Promise<CursorPage<Discussion>>;

  updateStatus(input: {
    id: string;
    fromStatus: DiscussionStatus;
    toStatus: DiscussionStatus;
    actorId: string;
    rejectionNote?: string | null;
    images?: DiscussionImage[];
  }): Promise<Discussion | null>;

  setPinnedReply(input: {
    discussionId: string;
    replyId: string | null;
    actorId: string;
  }): Promise<Discussion | null>;

  createReply(input: NewDiscussionReply): Promise<DiscussionReply>;
  findReplyById(id: string): Promise<DiscussionReply | null>;
  listReplies(discussionId: string): Promise<DiscussionReply[]>;
  /** Batch COUNT reply status=published per diskusi (satu query, bukan N+1). */
  countPublishedRepliesByDiscussionIds(
    discussionIds: string[],
  ): Promise<Map<string, number>>;
  /** User unik yang pernah membalas thread (semua status kecuali soft-delete opsional: semua). */
  listDistinctReplierUserIds(discussionId: string): Promise<string[]>;

  /** Lampirkan / ganti audio opening thread (owner, pending_review). */
  setDiscussionAudio(input: {
    id: string;
    audio: DiscussionReplyAudio;
  }): Promise<Discussion | null>;

  markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownReply(id: string, reviewerId: string): Promise<boolean>;

  updateReplyBodyWithRevision(input: {
    replyId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<DiscussionReply | null>;

  listReplyRevisions(replyId: string): Promise<DiscussionReplyRevision[]>;
}
