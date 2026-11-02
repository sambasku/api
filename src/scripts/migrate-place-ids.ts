/**
 * Normalisasi `places.id` slug -> ULID (data-only, idempoten).
 *
 * Latar: impor awal mengisi `places.id` dengan slug (`danau-biru`). Seed 0072
 * memakai ULID tapi `INSERT OR IGNORE` tidak menimpa baris lama. Validator
 * `place_ids` minta `opaqueId` (26 char) sehingga submit event dengan place
 * lama gagal VALIDATION_ERROR.
 *
 * Yang dilakukan per baris ber-id non-ULID:
 * 1. generate ULID baru, simpan pemetaan old->new di tabel temp;
 * 2. insert salinan places dengan id baru;
 * 3. pindahkan FK anak: event_places, place_images, place_views,
 *    place_contributions;
 * 4. hapus baris lama, drop tabel temp.
 *
 * Jalankan: pnpm tsx src/scripts/migrate-place-ids.ts
 * Env: DATABASE_URL (+ DATABASE_AUTH_TOKEN untuk libsql:// remote).
 * Aman dijalankan ulang (baris ULID tidak disentuh).
 */
import 'dotenv/config';
import { createClient, type Client } from '@libsql/client';
import { generateId } from '@/shared/utils/ulid';

const CHILD_TABLES = [
  'event_places',
  'place_images',
  'place_views',
  'place_contributions',
] as const;

function rowField(
  row: Record<string, unknown> | unknown[],
  key: string,
  index: number,
): unknown {
  if (Array.isArray(row)) return row[index];
  return row[key];
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() ?? '';
  if (!url) {
    console.error('[migrate-place-ids] DATABASE_URL wajib diisi');
    process.exit(1);
  }
  const client: Client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

  const slugRows = await client.execute(
    `SELECT id, slug FROM places WHERE length(id) <> 26`,
  );
  const targets = slugRows.rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
  }));
  if (targets.length === 0) {
    console.log('[migrate-place-ids] Semua places.id sudah ULID. Selesai.');
    client.close();
    return;
  }

  // Batching: satu statement per pemetaan, tapi insert-copy + delete pakai IN.
  const map = new Map<string, string>();
  for (const t of targets) {
    // ULID dari generateId bisa mulai angka yang bentrok urutan? Tidak -
    // ulid() selalu 26 char Crockford. Hindari tabrakan dengan id existing.
    map.set(t.id, generateId());
  }

  await client.execute('BEGIN');
  try {
    await client.execute(
      'CREATE TEMP TABLE IF NOT EXISTS _places_id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL, orig_slug TEXT NOT NULL)',
    );
    for (const [oldId, newId] of map) {
      const origSlug = targets.find((t) => t.id === oldId)?.slug;
      if (!origSlug) throw new Error(`Slug asli tidak ketemu untuk ${oldId}`);
      await client.execute({
        sql: 'INSERT OR IGNORE INTO _places_id_map (old_id, new_id, orig_slug) VALUES (?, ?, ?)',
        args: [oldId, newId, origSlug],
      });
    }

    // Pindahkan slug baris lama ke nama sementara supaya unique index slug
    // tidak bentrok saat baris baru (slug asli) di-insert.
    await client.execute(`
      UPDATE places
      SET slug = '__tmp_migrate_' || id
      WHERE id IN (SELECT old_id FROM _places_id_map)
    `);

    // Salin semua kolom places kecuali id (daftar kolom dinamis dari
    // PRAGMA table_info supaya tahan beda versi skema lokal/remote).
    const info = await client.execute('PRAGMA table_info(places)');
    const cols = info.rows.map((r) => String(rowField(r, 'name', 1)));
    const copyCols = cols.filter((c) => c !== 'id');
    if (copyCols.length === 0) {
      throw new Error('PRAGMA table_info(places) kosong');
    }
    const colSql = copyCols.join(', ');
    const srcSql = copyCols
      .map((c) => (c === 'slug' ? 'm.orig_slug' : `p."${c}"`))
      .join(', ');
    await client.execute(`
      INSERT INTO places (id, ${colSql})
      SELECT m.new_id, ${srcSql}
      FROM places p
      JOIN _places_id_map m ON m.old_id = p.id
      WHERE length(p.id) <> 26
    `);

    for (const table of CHILD_TABLES) {
      const res = await client.execute({
        sql: `UPDATE ${table} SET place_id = (
                SELECT m.new_id FROM _places_id_map m WHERE m.old_id = ${table}.place_id
              )
              WHERE place_id IN (SELECT old_id FROM _places_id_map)`,
      });
      console.log(`[migrate-place-ids] ${table}: ${res.rowsAffected} baris dipindah`);
    }

    await client.execute(
      'DELETE FROM places WHERE id IN (SELECT old_id FROM _places_id_map)',
    );

    await client.execute('COMMIT');
    console.log(`[migrate-place-ids] ${map.size} places.id slug -> ULID. Selesai.`);
  } catch (err) {
    await client.execute('ROLLBACK').catch(() => {});
    console.error('[migrate-place-ids] Gagal, rollback:', err);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

void main();
