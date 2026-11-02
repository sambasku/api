/**
 * Seed/upsert places dari data/places.json ke Turso.
 *
 * Usage (dari api/):
 *   DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm tsx src/scripts/seed-places.ts [path/ke/places.json]
 *
 * Idempotent: upsert by slug (unique index; id di DB = ULID dari 0072).
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
  shortDescription?: string | null;
  regionId?: string | null;
  hours?: string | null;
  contact?: string | { phone?: string | null; email?: string | null } | null;
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

function formatContact(contact: SeedPlace['contact']): string | null {
  if (contact == null) return null;
  if (typeof contact === 'string') {
    const text = contact.trim();
    if (!text || text.toLowerCase() === '[object object]') return null;
    return text;
  }
  const phone = contact.phone?.trim() ?? '';
  const email = contact.email?.trim() ?? '';
  const parts = [phone, email].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join('\n') : null;
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
    // Upsert by slug: slug punya UNIQUE index, id di DB = ULID (bukan slug).
    // Match by id saja bikin INSERT baru dan bentrok UNIQUE places_slug.
    const [existing] = await tx.select({ id: places.id }).from(places).where(eq(places.slug, p.slug)).limit(1);
    // Baris baru: id = ULID (konvensi repo). `p.id` di places.json = slug,
    // bukan id DB - jangan dipakai sebagai primary key.
    const placeId = existing?.id ?? generateId();
    if (existing) {
      await tx
        .update(places)
        .set({
          name: p.name,
          category: p.category,
          type,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          mapsUrl: p.mapsUrl ?? null,
          shortDescription: p.shortDescription ?? '',
          regionId: p.regionId ?? null,
          hours: p.hours ?? null,
          contact: formatContact(p.contact),
          authorId: p.authorId ?? null,
          sourcesJson,
          status: 'published',
          updatedAt: new Date(),
          deletedAt: null,
        })
        .where(eq(places.id, placeId));
      await tx.delete(placeImages).where(eq(placeImages.placeId, placeId));
    } else {
      await tx.insert(places).values({
        id: placeId,
        slug: p.slug,
        name: p.name,
        category: p.category,
        type,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        mapsUrl: p.mapsUrl ?? null,
        shortDescription: p.shortDescription ?? '',
        regionId: p.regionId ?? null,
        hours: p.hours ?? null,
        contact: formatContact(p.contact),
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
            placeId,
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
