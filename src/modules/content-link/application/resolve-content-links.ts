import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  articles,
  cuisines,
  events,
  karyas,
  kreators,
  layanans,
  places,
  usahas,
  words,
} from '@/shared/database/drizzle/schema';
import type {
  ContentLinkEndpoint,
  ContentLinkKind,
  ContentLinkRef,
  ResolvedContentLink,
} from '../domain/content-link';

type Card = {
  id: string;
  slug: string | null;
  title: string;
  coverUrl: string | null;
};

function keysForKind(
  refs: ContentLinkRef[],
  kind: ContentLinkKind,
): { ids: string[]; slugs: string[] } {
  const ids: string[] = [];
  const slugs: string[] = [];
  for (const ref of refs) {
    if (ref.kind !== kind) continue;
    if (ref.id) ids.push(ref.id);
    if (ref.slug) slugs.push(ref.slug);
  }
  return { ids: [...new Set(ids)], slugs: [...new Set(slugs)] };
}

function putCard(
  map: Map<string, Card>,
  entry: Card,
): void {
  map.set(entry.id, entry);
  if (entry.slug) map.set(entry.slug, entry);
}

/** Resolve ref → kartu tayang (batch per kind, tanpa N+1). */
export class ResolveContentLinks {
  constructor(private readonly db: AppDatabase) {}

  async resolve(refs: ContentLinkRef[]): Promise<ResolvedContentLink[]> {
    if (refs.length === 0) return [];
    const maps = await this.loadAll(refs);
    const out: ResolvedContentLink[] = [];
    for (const ref of refs) {
      const map = maps.get(ref.kind);
      if (!map) continue;
      const row =
        (ref.id ? map.get(ref.id) : undefined) ??
        (ref.slug ? map.get(ref.slug) : undefined);
      if (!row) continue;
      out.push({
        kind: ref.kind,
        id: row.id,
        slug: row.slug,
        title: row.title,
        coverUrl: row.coverUrl,
      });
    }
    return out;
  }

  /** Resolve endpoint yang sudah punya id (hasil list edges). */
  async resolveEndpoints(
    endpoints: ContentLinkEndpoint[],
  ): Promise<ResolvedContentLink[]> {
    return this.resolve(endpoints.map((e) => ({ kind: e.kind, id: e.id })));
  }

  private async loadAll(
    refs: ContentLinkRef[],
  ): Promise<Map<ContentLinkKind, Map<string, Card>>> {
    const [
      word,
      article,
      place,
      event,
      usaha,
      karya,
      kreator,
      cuisine,
      layanan,
    ] = await Promise.all([
      this.loadWords(refs),
      this.loadArticles(refs),
      this.loadPlaces(refs),
      this.loadEvents(refs),
      this.loadUsahas(refs),
      this.loadKaryas(refs),
      this.loadKreators(refs),
      this.loadCuisines(refs),
      this.loadLayanans(refs),
    ]);
    return new Map<ContentLinkKind, Map<string, Card>>([
      ['word', word],
      ['article', article],
      ['place', place],
      ['event', event],
      ['usaha', usaha],
      ['karya', karya],
      ['kreator', kreator],
      ['cuisine', cuisine],
      ['layanan', layanan],
    ]);
  }

  private async loadWords(refs: ContentLinkRef[]): Promise<Map<string, Card>> {
    const { ids } = keysForKind(refs, 'word');
    // slug untuk word = lemma atau id; terima id saja di resolve ketat.
    const slugIds = keysForKind(refs, 'word').slugs;
    const allIds = [...new Set([...ids, ...slugIds])];
    if (allIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: words.id, lemma: words.lemma })
      .from(words)
      .where(
        and(
          eq(words.status, 'published'),
          eq(words.isVerified, true),
          isNull(words.deletedAt),
          inArray(words.id, allIds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: null,
        title: row.lemma,
        coverUrl: null,
      });
    }
    return map;
  }

  private async loadArticles(
    refs: ContentLinkRef[],
  ): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'article');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(articles.id, ids));
    if (slugs.length) conds.push(inArray(articles.slug, slugs));
    const rows = await this.db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        coverUrl: articles.coverUrl,
      })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'published'),
          isNull(articles.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        coverUrl: row.coverUrl,
      });
    }
    return map;
  }

  private async loadPlaces(refs: ContentLinkRef[]): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'place');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(places.id, ids));
    if (slugs.length) conds.push(inArray(places.slug, slugs));
    const rows = await this.db
      .select({
        id: places.id,
        slug: places.slug,
        name: places.name,
      })
      .from(places)
      .where(
        and(
          eq(places.status, 'published'),
          isNull(places.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.name,
        coverUrl: null,
      });
    }
    return map;
  }

  private async loadEvents(refs: ContentLinkRef[]): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'event');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(events.id, ids));
    if (slugs.length) conds.push(inArray(events.slug, slugs));
    const rows = await this.db
      .select({
        id: events.id,
        slug: events.slug,
        name: events.name,
        posterUrls: events.posterUrls,
      })
      .from(events)
      .where(
        and(
          eq(events.status, 'published'),
          isNull(events.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.name,
        coverUrl: firstPosterUrl(row.posterUrls),
      });
    }
    return map;
  }

  private async loadUsahas(refs: ContentLinkRef[]): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'usaha');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(usahas.id, ids));
    if (slugs.length) conds.push(inArray(usahas.slug, slugs));
    const rows = await this.db
      .select({
        id: usahas.id,
        slug: usahas.slug,
        name: usahas.name,
        coverUrl: usahas.coverUrl,
      })
      .from(usahas)
      .where(
        and(
          eq(usahas.publishStatus, 'published'),
          isNull(usahas.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.name,
        coverUrl: row.coverUrl ?? null,
      });
    }
    return map;
  }

  private async loadKaryas(refs: ContentLinkRef[]): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'karya');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(karyas.id, ids));
    if (slugs.length) conds.push(inArray(karyas.slug, slugs));
    const rows = await this.db
      .select({
        id: karyas.id,
        slug: karyas.slug,
        title: karyas.title,
        coverUrl: karyas.coverUrl,
      })
      .from(karyas)
      .where(
        and(
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        coverUrl: row.coverUrl ?? null,
      });
    }
    return map;
  }

  private async loadKreators(
    refs: ContentLinkRef[],
  ): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'kreator');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(kreators.id, ids));
    if (slugs.length) conds.push(inArray(kreators.slug, slugs));
    const rows = await this.db
      .select({
        id: kreators.id,
        slug: kreators.slug,
        displayName: kreators.displayName,
      })
      .from(kreators)
      .where(and(isNull(kreators.deletedAt), or(...conds)));
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.displayName,
        coverUrl: null,
      });
    }
    return map;
  }

  private async loadCuisines(
    refs: ContentLinkRef[],
  ): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'cuisine');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(cuisines.id, ids));
    if (slugs.length) conds.push(inArray(cuisines.slug, slugs));
    const rows = await this.db
      .select({
        id: cuisines.id,
        slug: cuisines.slug,
        name: cuisines.name,
        imagesJson: cuisines.imagesJson,
      })
      .from(cuisines)
      .where(
        and(
          eq(cuisines.publishStatus, 'published'),
          isNull(cuisines.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.name,
        coverUrl: firstImageUrl(row.imagesJson),
      });
    }
    return map;
  }

  private async loadLayanans(
    refs: ContentLinkRef[],
  ): Promise<Map<string, Card>> {
    const { ids, slugs } = keysForKind(refs, 'layanan');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(layanans.id, ids));
    if (slugs.length) conds.push(inArray(layanans.slug, slugs));
    const rows = await this.db
      .select({
        id: layanans.id,
        slug: layanans.slug,
        name: layanans.name,
        logoUrl: layanans.logoUrl,
      })
      .from(layanans)
      .where(and(eq(layanans.publishStatus, 'published'), or(...conds)));
    const map = new Map<string, Card>();
    for (const row of rows) {
      putCard(map, {
        id: row.id,
        slug: row.slug,
        title: row.name,
        coverUrl: row.logoUrl ?? null,
      });
    }
    return map;
  }
}

function firstImageUrl(imagesJson: string | null): string | null {
  if (!imagesJson) return null;
  try {
    const parsed = JSON.parse(imagesJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0];
    if (first && typeof first === 'object' && 'url' in first) {
      const url = (first as { url?: unknown }).url;
      return typeof url === 'string' && url.length > 0 ? url : null;
    }
  } catch {
    return null;
  }
  return null;
}

function firstPosterUrl(posterUrls: unknown): string | null {
  if (!Array.isArray(posterUrls) || posterUrls.length === 0) return null;
  const first = posterUrls[0];
  return typeof first === 'string' && first.length > 0 ? first : null;
}
