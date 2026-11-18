import type { ResolvedContentLink } from '../domain/content-link';

/** Wire kartu `related[]` seragam lintas detail. */
export function toContentRelatedWire(rows: ResolvedContentLink[]) {
  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    slug: r.slug,
    title: r.title,
    cover_url: r.coverUrl,
  }));
}

/** Bentuk place legacy (name + cover_url) + id untuk klien baru. */
export function toPlaceRelatedWireFromContentLinks(rows: ResolvedContentLink[]) {
  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    slug: r.slug ?? r.id,
    name: r.title,
    title: r.title,
    category: null as string | null,
    type: null as string | null,
    cover_url: r.coverUrl,
  }));
}

/** Bentuk karya detail resolved. */
export function toKaryaRelatedWireFromContentLinks(rows: ResolvedContentLink[]) {
  return rows.map((r) => ({
    kind: r.kind,
    slug: r.slug,
    id: r.id,
    title: r.title,
    href_kind: r.kind,
  }));
}
