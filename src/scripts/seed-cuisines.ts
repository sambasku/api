/**
 * Seed/upsert cuisines dari data/cuisines.json ke Turso.
 *
 * Usage (dari api/):
 * DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm tsx src/scripts/seed-cuisines.ts [path/cuisines.json]
 *
 * Idempotent: upsert by slug. Atribusi gambar + sumber + lisensi disimpan
 * VERBATIM di kolom JSON (PRD kuliner 13 - jangan hilangkan atribusi).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { generateId } from '@/shared/utils/ulid';

config({ quiet: true });

type SeedCuisine = {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  license?: string | null;
  region?: string | null;
  servingSuggestion?: string | null;
  ingredients?: string[];
  tags?: string[];
  images?: Array<{
    url: string;
    isMain?: boolean;
    attribution?: {
      name?: string;
      provider?: string;
      url?: string;
      license?: string;
      license_url?: string;
    } | null;
  }>;
  sources?: Array<{
    name: string;
    type?: string;
    address: string;
    license?: string | null;
    licenseUrl?: string | null;
  }>;
};

const pathArg = process.argv[2] ?? resolve(process.cwd(), '../data/cuisines.json');
const raw = JSON.parse(readFileSync(pathArg, 'utf8')) as {
  version?: number;
  license?: string;
  cuisines: SeedCuisine[];
};
const collectionLicense = raw.license ?? null;
const list = raw.cuisines ?? [];
if (list.length === 0) {
  console.error('Tidak ada cuisines di', pathArg);
  process.exit(1);
}

let ok = 0;
for (const c of list) {
  const imagesJson = c.images?.length
    ? JSON.stringify(
        c.images.map((img) => ({
          url: img.url,
          isMain: img.isMain === true,
          attribution: img.attribution ?? null,
        })),
      )
    : null;
  const ingredientsJson = c.ingredients?.length
    ? JSON.stringify(c.ingredients)
    : null;
  const tagsJson = c.tags?.length ? JSON.stringify(c.tags) : null;
  const sourcesJson = c.sources?.length
    ? JSON.stringify(
        c.sources.map((s) => ({
          name: s.name,
          type: s.type ?? 'other',
          address: s.address,
          license: s.license ?? null,
          licenseUrl: s.licenseUrl ?? null,
        })),
      )
    : null;

  const [existing] = await db
    .select({ id: cuisines.id })
    .from(cuisines)
    .where(eq(cuisines.slug, c.slug))
    .limit(1);
  const values = {
    name: c.name,
    description: c.description ?? null,
    originRegion: c.region ?? null,
    servingSuggestion: c.servingSuggestion ?? null,
    imagesJson,
    ingredientsJson,
    tagsJson,
    sourcesJson,
    license: c.license ?? collectionLicense,
    publishStatus: 'published' as const,
    updatedAt: new Date(),
    deletedAt: null,
  };
  if (existing) {
    await db.update(cuisines).set(values).where(eq(cuisines.id, existing.id));
  } else {
    await db.insert(cuisines).values({
      id: generateId(),
      slug: c.slug,
      categoryId: null,
      publishedAt: new Date(),
      ...values,
    });
  }
  ok++;
}

console.log(`Seed cuisines selesai: ${ok} upsert. File: ${pathArg}`);
await closeDb();
process.exit(0);
