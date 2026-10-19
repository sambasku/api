/**
 * Seed/upsert places dari data/places.json ke Turso.
 *
 * Usage (dari api/):
 *   DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm tsx src/scripts/seed-places.ts [path/ke/places.json]
 *
 * Idempotent: upsert by id (= slug di seed lama). Images diganti penuh per place.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { placeImages, places } from '@/shared/database/drizzle/schema/places.schema';
import { generateId } from '@/shared/utils/ulid';

config({ quiet: true });

type SeedImage = {
  url: string;
  isMain?: boolean;
  attribution?: {
    name?: string;
    provider?: string;
    url?: string;
    license?: string;
    license_url?: string;
    source?: string;
    authorId?: string;
  } | null;
};

type SeedPlace = {
  id: string;
  slug: string;
  name: string;
  category: 'wisata' | 'kuliner' | 'budaya';
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  shortDescription: string;
  regionId?: string | null;
  hours?: string | null;
  contact?: string | null;
  authorId?: string | null;
  images?: SeedImage[];
  sources?: Array<{
    name: string;
    type?: string;
    address: string;
    license?: string | null;
    licenseUrl?: string | null;
  }>;
};

const pathArg = process.argv[2] ?? resolve(process.cwd(), '../data/places.json');
const raw = JSON.parse(readFileSync(pathArg, 'utf8')) as { places: SeedPlace[] };
const list = raw.places ?? [];
if (list.length === 0) {
  console.error('Tidak ada places di', pathArg);
  process.exit(1);
}

const allowedType = new Set(['sejarah', 'alam', 'budaya', 'pantai', 'belanja']);
const allowedCat = new Set(['wisata', 'kuliner', 'budaya']);

let ok = 0;
let skip = 0;

for (const p of list) {
  if (!allowedCat.has(p.category)) {
    console.warn('SKIP category:', p.slug, p.category);
    skip++;
    continue;
  }
  const type =
    p.type && allowedType.has(p.type) ? (p.type as 'sejarah' | 'alam' | 'budaya' | 'pantai' | 'belanja') : null;
  const sourcesJson = JSON.stringify(
    (p.sources ?? []).map((s) => ({
      name: s.name,
      type: s.type ?? 'other',
      address: s.address,
      license: s.license ?? null,
      licenseUrl: s.licenseUrl ?? null,
    })),
  );

  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: places.id }).from(places).where(eq(places.id, p.id)).limit(1);
    if (existing) {
      await tx
        .update(places)
        .set({
          slug: p.slug,
          name: p.name,
          category: p.category,
          type,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          mapsUrl: p.mapsUrl ?? null,
          shortDescription: p.shortDescription,
          regionId: p.regionId ?? null,
          hours: p.hours ?? null,
          contact: p.contact ?? null,
          authorId: p.authorId ?? null,
          sourcesJson,
          status: 'published',
          updatedAt: new Date(),
          deletedAt: null,
        })
        .where(eq(places.id, p.id));
      await tx.delete(placeImages).where(eq(placeImages.placeId, p.id));
    } else {
      await tx.insert(places).values({
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        type,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        mapsUrl: p.mapsUrl ?? null,
        shortDescription: p.shortDescription,
        regionId: p.regionId ?? null,
        hours: p.hours ?? null,
        contact: p.contact ?? null,
        authorId: p.authorId ?? null,
        sourcesJson,
        status: 'published',
      });
    }

    const imgs = p.images ?? [];
    if (imgs.length > 0) {
      let sawMain = false;
      await tx.insert(placeImages).values(
        imgs.map((img, i) => {
          const isMain = img.isMain === true && !sawMain ? ((sawMain = true), true) : false;
          const attr = img.attribution?.name
            ? JSON.stringify({
                name: img.attribution.name,
                provider: img.attribution.provider,
                url: img.attribution.url,
                license: img.attribution.license,
                licenseUrl: img.attribution.license_url,
                source: img.attribution.source,
                authorId: img.attribution.authorId,
              })
            : null;
          return {
            id: generateId(),
            placeId: p.id,
            url: img.url,
            isMain: isMain || (i === 0 && !imgs.some((x) => x.isMain)),
            sortOrder: i,
            attributionJson: attr,
          };
        }),
      );
    }
  });
  ok++;
}

console.log(`Seed places selesai: ${ok} upsert, ${skip} skip. File: ${pathArg}`);
await closeDb();
process.exit(0);
