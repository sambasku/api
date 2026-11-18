/**
 * Backfill content_links dari legacy karyas.related_json + places.related_json.
 *
 * - Idempoten: skip pasangan yang sudah ada (UNIQUE a/b).
 * - Resolve slug → id via ResolveContentLinks; yang gagal di-skip + log.
 * - Tidak menghapus edge yang sudah ada (hanya insert).
 *
 * Jalankan: pnpm db:backfill-content-links
 */
import 'dotenv/config';
import { and, eq, sql } from 'drizzle-orm';

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { contentLinks, karyas, places } =
  await import('../shared/database/drizzle/schema');
const { ResolveContentLinks } =
  await import('../modules/content-link/application/resolve-content-links');
const {
  canonicalizePair,
  isContentLinkKind,
} = await import('../modules/content-link/domain/content-link');
const { generateId } = await import('../shared/utils/ulid');

type RawRef = { kind?: unknown; id?: unknown; slug?: unknown };

function parseRefs(raw: string | null | undefined): RawRef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RawRef[]) : [];
  } catch {
    return [];
  }
}

async function insertPair(input: {
  aKind: string;
  aId: string;
  bKind: string;
  bId: string;
}): Promise<'inserted' | 'exists' | 'invalid'> {
  if (!isContentLinkKind(input.aKind) || !isContentLinkKind(input.bKind)) {
    return 'invalid';
  }
  const pair = canonicalizePair(
    { kind: input.aKind, id: input.aId },
    { kind: input.bKind, id: input.bId },
  );
  if (!pair) return 'invalid';

  const existing = await db
    .select({ id: contentLinks.id })
    .from(contentLinks)
    .where(
      and(
        eq(contentLinks.aKind, pair.a.kind),
        eq(contentLinks.aId, pair.a.id),
        eq(contentLinks.bKind, pair.b.kind),
        eq(contentLinks.bId, pair.b.id),
      ),
    )
    .limit(1);
  if (existing.length > 0) return 'exists';

  await db.insert(contentLinks).values({
    id: generateId(),
    aKind: pair.a.kind,
    aId: pair.a.id,
    bKind: pair.b.kind,
    bId: pair.b.id,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: null,
  });
  return 'inserted';
}

async function backfillAnchor(input: {
  kind: 'karya' | 'place';
  id: string;
  refs: RawRef[];
  resolver: InstanceType<typeof ResolveContentLinks>;
  stats: { inserted: number; exists: number; skipped: number };
}): Promise<void> {
  const refs = input.refs
    .map((r) => {
      const kind = typeof r.kind === 'string' ? r.kind : '';
      const id = typeof r.id === 'string' ? r.id : undefined;
      const slug = typeof r.slug === 'string' ? r.slug : undefined;
      if (!isContentLinkKind(kind) || (!id && !slug)) return null;
      return { kind, id, slug };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (refs.length === 0) return;

  const resolved = await input.resolver.resolve(refs);
  for (const card of resolved) {
    const result = await insertPair({
      aKind: input.kind,
      aId: input.id,
      bKind: card.kind,
      bId: card.id,
    });
    if (result === 'inserted') input.stats.inserted += 1;
    else if (result === 'exists') input.stats.exists += 1;
    else input.stats.skipped += 1;
  }
  input.stats.skipped += Math.max(0, refs.length - resolved.length);
}

async function main() {
  const resolver = new ResolveContentLinks(db);
  const stats = { inserted: 0, exists: 0, skipped: 0, anchors: 0 };

  const karyaRows = await db
    .select({
      id: karyas.id,
      relatedJson: karyas.relatedJson,
    })
    .from(karyas)
    .where(sql`${karyas.relatedJson} IS NOT NULL AND ${karyas.relatedJson} != '[]'`);

  for (const row of karyaRows) {
    stats.anchors += 1;
    await backfillAnchor({
      kind: 'karya',
      id: row.id,
      refs: parseRefs(row.relatedJson),
      resolver,
      stats,
    });
  }

  const placeRows = await db
    .select({
      id: places.id,
      relatedJson: places.relatedJson,
    })
    .from(places)
    .where(sql`${places.relatedJson} IS NOT NULL AND ${places.relatedJson} != '[]'`);

  for (const row of placeRows) {
    stats.anchors += 1;
    await backfillAnchor({
      kind: 'place',
      id: row.id,
      refs: parseRefs(row.relatedJson),
      resolver,
      stats,
    });
  }

  console.log(
    `[backfill-content-links] anchors=${stats.anchors} inserted=${stats.inserted} exists=${stats.exists} skipped=${stats.skipped}`,
  );
}

main()
  .catch((err) => {
    console.error('[backfill-content-links] gagal', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
