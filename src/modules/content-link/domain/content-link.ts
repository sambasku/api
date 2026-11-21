import {
  CONTENT_LINK_KINDS,
  type ContentLinkKind,
} from '@/shared/database/drizzle/schema/content-links.schema';

export { CONTENT_LINK_KINDS, type ContentLinkKind };

/** Maks tautan per entitas (kedua sisi endpoint dihitung). */
export const CONTENT_LINK_CAP = 12;

export interface ContentLinkRef {
  kind: ContentLinkKind;
  id?: string;
  slug?: string;
}

export interface ContentLinkEndpoint {
  kind: ContentLinkKind;
  id: string;
}

export interface ContentLinkRow {
  id: string;
  aKind: ContentLinkKind;
  aId: string;
  bKind: ContentLinkKind;
  bId: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ResolvedContentLink {
  kind: ContentLinkKind;
  id: string;
  slug: string | null;
  title: string;
  coverUrl: string | null;
}

export function isContentLinkKind(value: string): value is ContentLinkKind {
  return (CONTENT_LINK_KINDS as readonly string[]).includes(value);
}

/** Kunci lexicographic untuk urutan kanonik undirected. */
export function endpointKey(kind: ContentLinkKind, id: string): string {
  return `${kind}\0${id}`;
}

/**
 * Urutkan dua endpoint supaya (a,b) unik undirected.
 * Self-link (kind+id sama) mengembalikan null.
 */
export function canonicalizePair(
  left: ContentLinkEndpoint,
  right: ContentLinkEndpoint,
): { a: ContentLinkEndpoint; b: ContentLinkEndpoint } | null {
  if (left.kind === right.kind && left.id === right.id) return null;
  const leftKey = endpointKey(left.kind, left.id);
  const rightKey = endpointKey(right.kind, right.id);
  if (leftKey < rightKey) return { a: left, b: right };
  return { a: right, b: left };
}
