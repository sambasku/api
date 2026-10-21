import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

/** Sama dengan `when` migrasi 0078_regions_seed. Semua id seed berbagi timestamp ini. */
export const REGION_SEED_TIME = 1_800_846_900_000;

/** ULID stabil dari slug `regions.json`. Ulangi generator, id tidak berubah. */
export function regionSeedId(slug: string): string {
  const hash = createHash('sha256').update(`sambasku:region:${slug}`).digest();
  let i = 0;
  return ulid(REGION_SEED_TIME, () => hash[i++] / 256);
}
