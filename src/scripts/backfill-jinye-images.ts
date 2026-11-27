/**
 * Backfill foto Jinye (post + komentar) dari ImageKit ke repo GitHub publik.
 *
 * - Hanya baris `provider_file_id` non-`assets/` (ImageKit lama); baris GitHub dilewati.
 * - Idempoten: ulangi aman; baris gagal tetap ImageKit.
 * - File ImageKit dihapus SETELAH update DB berhasil (best-effort).
 * - Update DB gagal -> file GitHub baru dihapus lagi (tanpa file yatim).
 * - Hanya mengunduh dari host IMAGEKIT_URL_ENDPOINT kita (cegah SSRF).
 *
 * Jalankan: pnpm db:backfill-jinye-images [-- --dry-run] [--limit=N]
 * GitHub Actions: workflow `backfill-jinye-images.yml` (workflow_dispatch).
 */
import 'dotenv/config';
import { and, asc, eq, gt, sql } from 'drizzle-orm';

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { jinye, jinyeComments } = await import('../shared/database/drizzle/schema');
const { env } = await import('../shared/config/env');
const { createPublicImageStorage } =
  await import('../modules/public-image/infrastructure/public-image-storage.factory');
const { createImageStorage } =
  await import('../modules/image/infrastructure/image-storage.factory');
const { migrateJinyeImageRows, fetchImageBytesLimited } =
  await import('../modules/jinye/application/utils/migrate-jinye-images');

const CHUNK = 100;
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;

type Table = typeof jinye | typeof jinyeComments;

async function processTable(
  label: 'jinye' | 'jinye_comments',
  table: Table,
  deps: Parameters<typeof migrateJinyeImageRows>[1],
  publicStorage: ReturnType<typeof createPublicImageStorage>,
  imageKit: ReturnType<typeof createImageStorage>,
) {
  let lastId = '';
  let seen = 0;
  let migrated = 0;
  let failed = 0;
  let rowsUpdated = 0;
  for (;;) {
    const rows = await db
      .select({ id: table.id, images: table.images })
      .from(table)
      .where(and(gt(table.id, lastId), sql`${table.images} != '[]'`))
      .orderBy(asc(table.id))
      .limit(CHUNK);
    if (rows.length === 0) break;
    for (const row of rows) {
      lastId = row.id;
      if (seen >= limit) return { seen, migrated, failed, rowsUpdated };
      const images = Array.isArray(row.images) ? row.images : [];
      if (images.length === 0) continue;
      seen += 1;
      const result = await migrateJinyeImageRows(images, deps);
      failed += result.failed;
      if (result.migrated === 0) continue;
      migrated += result.migrated;
      if (dryRun) continue;
      try {
        await db
          .update(table)
          .set({ images: result.images })
          .where(eq(table.id, row.id));
        rowsUpdated += 1;
      } catch (err) {
        console.error(`[backfill-jinye-images] update ${label}=${row.id} gagal`, err);
        for (const f of result.uploaded) {
          await publicStorage.delete(f.path, f.sha);
        }
        continue;
      }
      for (const fileId of result.legacyFileIds) {
        try {
          await imageKit.deleteFile(fileId);
        } catch (err) {
          console.warn(`[backfill-jinye-images] hapus ImageKit ${fileId} gagal`, err);
        }
      }
    }
    console.log(`[backfill-jinye-images] ${label} progress seen=${seen} migrated=${migrated}`);
  }
  return { seen, migrated, failed, rowsUpdated };
}

async function main() {
  console.log(`[backfill-jinye-images] mulai dryRun=${dryRun} limit=${limit}`);
  const publicStorage = createPublicImageStorage();
  const imageKit = createImageStorage();
  const deps = {
    imageKitEndpoint: env.IMAGEKIT_URL_ENDPOINT,
    fetchBytes: (url: string) => fetchImageBytesLimited(url),
    upload: (input: { path: string; content: Uint8Array; mimeType: string }) =>
      publicStorage.upload(input),
  };
  const posts = await processTable('jinye', jinye, deps, publicStorage, imageKit);
  console.log('[backfill-jinye-images] jinye', posts);
  const comments = await processTable('jinye_comments', jinyeComments, deps, publicStorage, imageKit);
  console.log('[backfill-jinye-images] jinye_comments', comments);
  console.log('[backfill-jinye-images] selesai');
}

try {
  await main();
} catch (err) {
  console.error('[backfill-jinye-images] gagal', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
