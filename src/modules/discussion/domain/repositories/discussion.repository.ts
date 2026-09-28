import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewDiscussion,
  NewDiscussionReply,
  Discussion,
  DiscussionImage,
  DiscussionListFilter,
  DiscussionReply,
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

  markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownReply(id: string, reviewerId: string): Promise<boolean>;
}
