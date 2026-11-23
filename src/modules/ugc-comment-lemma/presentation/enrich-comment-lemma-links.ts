import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import type { UgcCommentLemmaRepository } from '../domain/repositories/ugc-comment-lemma.repository';
import {
  groupLemmaLinksByCommentId,
  lemmaLinksWireForComment,
} from './ugc-comment-lemma-wire';

export async function attachLemmaLinksToCommentWireItems<T extends { id: string }>(
  repo: UgcCommentLemmaRepository,
  anchorKind: UgcCommentAnchorKind,
  items: T[],
  toWire: (item: T) => Record<string, unknown>,
): Promise<Array<Record<string, unknown> & { lemma_links: ReturnType<typeof lemmaLinksWireForComment> }>> {
  if (items.length === 0) return [];
  const links = await repo.listActiveForComments(
    anchorKind,
    items.map((i) => i.id),
  );
  const grouped = groupLemmaLinksByCommentId(links);
  return items.map((item) => ({
    ...toWire(item),
    lemma_links: lemmaLinksWireForComment(grouped, item.id),
  }));
}