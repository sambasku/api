/**
 * Seed/upsert regions dari data/regions.json ke Turso.
 *
 * Usage (dari api/):
 *   DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm tsx src/scripts/seed-regions.ts [path/ke/regions.json]
 *
 * Idempotent: upsert by id.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { regions } from '@/shared/database/drizzle/schema/regions.schema';

config({ quiet: true });

type SeedRegion = {
  id: string;
  name: string;
  type: 'kecamatan' | 'desa';
  parentId?: string;
  code?: string;
  lat?: number;
  lng?: number;
};

const pathArg = process.argv[2] ?? resolve(process.cwd(), '../data/regions.json');
const raw = JSON.parse(readFileSync(pathArg, 'utf8')) as { regions: SeedRegion[] };
const list = raw.regions ?? [];
if (list.length === 0) {
  console.error('Tidak ada regions di', pathArg);
  process.exit(1);
}

let ok = 0;
let skip = 0;

for (const r of list) {
  if (r.type !== 'kecamatan' && r.type !== 'desa') {
    console.warn('SKIP type:', r.id, r.type);
    skip++;
    continue;
  }
  if (r.type === 'desa' && !r.parentId) {
    console.warn('SKIP desa tanpa parent:', r.id);
    skip++;
    continue;
  }
  const values = {
    id: r.id,
    name: r.name,
    type: r.type,
    parentId: r.type === 'desa' ? (r.parentId ?? null) : null,
    code: r.code ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    status: 'published' as const,
    sortOrder: 0,
    updatedAt: new Date(),
  };

  const [existing] = await db.select({ id: regions.id }).from(regions).where(eq(regions.id, r.id)).limit(1);
  if (existing) {
    await db
      .update(regions)
      .set({
        name: values.name,
        type: values.type,
        parentId: values.parentId,
        code: values.code,
        lat: values.lat,
        lng: values.lng,
        status: values.status,
        updatedAt: values.updatedAt,
        deletedAt: null,
      })
      .where(eq(regions.id, r.id));
  } else {
    await db.insert(regions).values({
      ...values,
      createdAt: new Date(),
    });
  }
  ok++;
}

console.log(`OK upsert ${ok}, skip ${skip}, total seed ${list.length}`);
await closeDb();
