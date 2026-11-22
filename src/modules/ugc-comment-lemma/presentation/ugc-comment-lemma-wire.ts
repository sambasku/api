import type { UgcCommentLemmaLink } from '../domain/entities/ugc-comment-lemma.entity';

export function toUgcCommentLemmaLinkWire(link: UgcCommentLemmaLink) {
  return {
    id: link.id,
    anchor_kind: link.anchorKind,
    host_id: link.hostId,
    comment_id: link.commentId,
    start: link.start,
    end: link.end,
    word_id: link.wordId,
    lemma: link.lemma,
    status: link.status,
    source: link.source,
    proposed_word_id: link.proposedWordId,
    proposed_lemma: link.proposedLemma,
    proposed_by: link.proposedBy,
    created_at: link.createdAt.toISOString(),
  };
}

export function groupLemmaLinksByCommentId(
  links: UgcCommentLemmaLink[],
): Map<string, UgcCommentLemmaLink[]> {
  const map = new Map<string, UgcCommentLemmaLink[]>();
  for (const link of links) {
    const list = map.get(link.commentId) ?? [];
    list.push(link);
    map.set(link.commentId, list);
  }
  return map;
}

export function lemmaLinksWireForComment(
  map: Map<string, UgcCommentLemmaLink[]>,
  commentId: string,
): ReturnType<typeof toUgcCommentLemmaLinkWire>[] {
  const items = map.get(commentId) ?? [];
  return items.map(toUgcCommentLemmaLinkWire);
}