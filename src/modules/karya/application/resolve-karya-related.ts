import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  articles,
  events,
  karyas,
  kreators,
  places,
  usahas,
  words,
} from '@/shared/database/drizzle/schema';
import type { KaryaRelatedRef } from '../domain/karya';

export interface ResolvedKaryaRelatedWire {
  kind: KaryaRelatedRef['kind'];
  slug: string | null;
  id: string;
  title: string;
  href_kind: KaryaRelatedRef['kind'];
}

function keysForKind(
  refs: KaryaRelatedRef[],
  kind: KaryaRelatedRef['kind'],
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

export class ResolveKaryaRelated {
  constructor(private readonly db: AppDatabase) {}

  async resolve(refs: KaryaRelatedRef[]): Promise<ResolvedKaryaRelatedWire[]> {
    if (refs.length === 0) return [];
    const [
      placeMap,
      eventMap,
      articleMap,
      usahaMap,
      kreatorMap,
      karyaMap,
      wordMap,
    ] = await Promise.all([
      this.loadPlaces(refs),
      this.loadEvents(refs),
      this.loadArticles(refs),
      this.loadUsahas(refs),
      this.loadKreators(refs),
      this.loadKaryas(refs),
      this.loadWords(refs),
    ]);

    const out: ResolvedKaryaRelatedWire[] = [];
    for (const ref of refs) {
      const key = ref.id ?? ref.slug;
      if (!key) continue;
      const pick = (map: Map<string, { id: string; slug: string | null; title: string }>) => {
        const row = (ref.id && map.get(ref.id)) || (ref.slug && map.get(ref.slug));
        if (!row) return null;
        return {
          kind: ref.kind,
          slug: row.slug,
          id: row.id,
          title: row.title,
          href_kind: ref.kind,
        } satisfies ResolvedKaryaRelatedWire;
      };
      const maps = {
        place: placeMap,
        event: eventMap,
        article: articleMap,
        usaha: usahaMap,
        kreator: kreatorMap,
        karya: karyaMap,
        word: wordMap,
      } as const;
      const resolved = pick(maps[ref.kind]);
      if (resolved) out.push(resolved);
    }
    return out;
  }

  private async loadPlaces(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'place');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(places.id, ids));
    if (slugs.length) conds.push(inArray(places.slug, slugs));
    const rows = await this.db
      .select({ id: places.id, slug: places.slug, name: places.name })
      .from(places)
      .where(
        and(
          eq(places.status, 'published'),
          isNull(places.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.name };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadEvents(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'event');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(events.id, ids));
    if (slugs.length) conds.push(inArray(events.slug, slugs));
    const rows = await this.db
      .select({ id: events.id, slug: events.slug, name: events.name })
      .from(events)
      .where(
        and(
          eq(events.status, 'published'),
          isNull(events.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.name };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadArticles(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'article');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(articles.id, ids));
    if (slugs.length) conds.push(inArray(articles.slug, slugs));
    const rows = await this.db
      .select({ id: articles.id, slug: articles.slug, title: articles.title })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'published'),
          isNull(articles.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.title };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadUsahas(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'usaha');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(usahas.id, ids));
    if (slugs.length) conds.push(inArray(usahas.slug, slugs));
    const rows = await this.db
      .select({ id: usahas.id, slug: usahas.slug, name: usahas.name })
      .from(usahas)
      .where(and(eq(usahas.publishStatus, 'published'), or(...conds)));
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.name };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadKreators(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
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
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.displayName };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadKaryas(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'karya');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(karyas.id, ids));
    if (slugs.length) conds.push(inArray(karyas.slug, slugs));
    const rows = await this.db
      .select({ id: karyas.id, slug: karyas.slug, title: karyas.title })
      .from(karyas)
      .where(
        and(
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: row.slug, title: row.title };
      map.set(row.id, entry);
      map.set(row.slug, entry);
    }
    return map;
  }

  private async loadWords(
    refs: KaryaRelatedRef[],
  ): Promise<Map<string, { id: string; slug: string | null; title: string }>> {
    const { ids, slugs } = keysForKind(refs, 'word');
    if (ids.length === 0 && slugs.length === 0) return new Map();
    const conds = [];
    if (ids.length) conds.push(inArray(words.id, ids));
    if (slugs.length) conds.push(inArray(words.id, slugs));
    const rows = await this.db
      .select({ id: words.id, lemma: words.lemma })
      .from(words)
      .where(
        and(
          eq(words.status, 'published'),
          eq(words.isVerified, true),
          isNull(words.deletedAt),
          or(...conds),
        ),
      );
    const map = new Map<string, { id: string; slug: string | null; title: string }>();
    for (const row of rows) {
      const entry = { id: row.id, slug: null, title: row.lemma };
      map.set(row.id, entry);
    }
    return map;
  }
}