import type {
  UgcCommentAnchorKind,
  UgcCommentLemmaLinkSource,
} from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import type { UgcCommentLemmaLink } from '../entities/ugc-comment-lemma.entity';

export interface UgcCommentLemmaRepository {
  create(input: {
    anchorKind: UgcCommentAnchorKind;
    hostId: string;
    commentId: string;
    start: number;
    end: number;
    wordId: string;
    source: UgcCommentLemmaLinkSource;
  }): Promise<UgcCommentLemmaLink>;

  findById(id: string): Promise<UgcCommentLemmaLink | null>;

  listActiveForComment(
    anchorKind: UgcCommentAnchorKind,
    commentId: string,
  ): Promise<UgcCommentLemmaLink[]>;

  listActiveForComments(
    anchorKind: UgcCommentAnchorKind,
    commentIds: string[],
  ): Promise<UgcCommentLemmaLink[]>;

  deleteById(id: string): Promise<boolean>;

  markStaleForComment(
    anchorKind: UgcCommentAnchorKind,
    commentId: string,
  ): Promise<number>;
}