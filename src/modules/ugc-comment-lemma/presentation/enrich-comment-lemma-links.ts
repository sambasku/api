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

/**
 * Tempel `lemma_links` pada komentar 2-level (top-level + `replies[]`)
 * dalam SATU batch query ke `ugc_comment_lemma_links` (tanpa N+1).
 */
export async function attachLemmaLinksToNestedCommentWireItems<
  T extends { id: string; replies?: T[] },
>(
  repo: UgcCommentLemmaRepository | undefined,
  anchorKind: UgcCommentAnchorKind,
  items: T[],
  toWire: (item: T) => Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  if (items.length === 0) return [];
  const allIds: string[] = [];
  for (const item of items) {
    allIds.push(item.id);
    if (item.replies) {
      for (const reply of item.replies) {
        allIds.push(reply.id);
      }
    }
  }
  const links = repo ? await repo.listActiveForComments(anchorKind, allIds) : [];
  const grouped = groupLemmaLinksByCommentId(links);
  return items.map((item) => ({
    ...toWire(item),
    lemma_links: lemmaLinksWireForComment(grouped, item.id),
    replies: (item.replies ?? []).map((reply) => ({
      ...toWire(reply),
      lemma_links: lemmaLinksWireForComment(grouped, reply.id),
    })),
  }));
}