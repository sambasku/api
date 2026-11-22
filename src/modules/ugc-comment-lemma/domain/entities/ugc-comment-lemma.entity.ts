import type {
  UgcCommentAnchorKind,
  UgcCommentLemmaLinkSource,
  UgcCommentLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';

export interface UgcCommentLemmaLink {
  id: string;
  anchorKind: UgcCommentAnchorKind;
  hostId: string;
  commentId: string;
  start: number;
  end: number;
  wordId: string;
  lemma: string | null;
  status: UgcCommentLemmaLinkStatus;
  source: UgcCommentLemmaLinkSource;
  proposedWordId: string | null;
  proposedLemma: string | null;
  proposedBy: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}