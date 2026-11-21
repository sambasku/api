import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  DiscussionLemmaLinkSource,
  DiscussionLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/discussion-lemma-links.schema';
import type {
  NewDiscussion,
  NewDiscussionReply,
  Discussion,
  DiscussionImage,
  DiscussionLemmaLink,
  DiscussionListFilter,
  DiscussionReply,
  DiscussionReplyAudio,
  DiscussionReplyRevision,
  DiscussionRevision,
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

  /** Soft-delete OP oleh penulis (#202): published → deleted_by_author. */
  markDiscussionDeletedByAuthor(id: string, actorId: string): Promise<boolean>;

  updateReplyBodyWithRevision(input: {
    replyId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<DiscussionReply | null>;

  listReplyRevisions(replyId: string): Promise<DiscussionReplyRevision[]>;

  /**
   * Edit OP published (#202): body + link; snapshot revisi bila body berubah.
   * `requeuePendingReview` → status pending_review (pra-moderasi ulang).
   */
  updateDiscussionBodyWithRevision(input: {
    discussionId: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
    linkUrl: string | null;
    requeuePendingReview: boolean;
  }): Promise<Discussion | null>;

  listDiscussionRevisions(discussionId: string): Promise<DiscussionRevision[]>;

  /** OP only (reply_id IS NULL): active/pending_correction → stale. */
  markLemmaLinksStale(discussionId: string): Promise<number>;
  markReplyLemmaLinksStale(replyId: string): Promise<number>;

  createLemmaLink(input: {
    discussionId: string;
    replyId?: string | null;
    start: number;
    end: number;
    wordId: string;
    source: DiscussionLemmaLinkSource;
    status?: DiscussionLemmaLinkStatus;
  }): Promise<DiscussionLemmaLink>;
  findLemmaLinkById(id: string): Promise<DiscussionLemmaLink | null>;
  listLemmaLinksByDiscussionId(
    discussionId: string,
  ): Promise<DiscussionLemmaLink[]>;
  listActiveLemmaLinksForTarget(input: {
    discussionId?: string | null;
    replyId?: string | null;
  }): Promise<DiscussionLemmaLink[]>;
  updateLemmaLink(
    id: string,
    patch: {
      wordId?: string;
      status?: DiscussionLemmaLinkStatus;
      source?: DiscussionLemmaLinkSource;
      proposedWordId?: string | null;
      proposedBy?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
    },
  ): Promise<DiscussionLemmaLink | null>;
  deleteLemmaLink(id: string): Promise<boolean>;
}
