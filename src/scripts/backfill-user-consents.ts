/**
 * Backfill user_consents untuk user existing (rollout consent OAuth).
 *
 * Kenapa: middleware `requireLegalConsent` memblok aksi tulis kontributor
 * bila user belum punya consent versi aktif. User existing tidak pernah
 * melihat checkbox (fitur ini baru), jadi tanpa backfill mereka kena 403
 * setelah deploy. Script ini mengisi consent mereka SEBELUM middleware aktif.
 *
 * Aturan:
 * - Hanya user `deleted_at IS NULL` yang belum punya baris `terms`.
 * - Versi = versi aktif saat script jalan (bukan tanggal daftar mereka).
 * - source = 'seed_backfill' -> audit trail jujur: ini migrasi, bukan
 *   centangan user. Bukan `social_gate` (itu untuk user yang setuju di app).
 * - Idempoten: user yang sudah punya consent tidak disentuh.
 * - Skip + warning bila legal versions belum dikonfigurasi (tidak ada
 *   versi yang bisa dicatat).
 *
 * Jalankan: pnpm db:backfill-consents
 * (DATABASE_URL harus menunjuk DB target).
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';

// Import client SETELAH dotenv load (client -> env.ts validasi).
const { db, closeDb } = await import('../shared/database/drizzle/client');
const { appSettings, userConsents, users } = await import('../shared/database/drizzle/schema');

const TERMS_KEY = 'legal.terms_version';
const PRIVACY_KEY = 'legal.privacy_version';
const CHUNK = 500;

async function activeVersions(): Promise<{ terms: string; privacy: string } | null> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(sql`${appSettings.key} IN (${TERMS_KEY}, ${PRIVACY_KEY})`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const terms = map[TERMS_KEY];
  const privacy = map[PRIVACY_KEY];
  return terms && privacy ? { terms, privacy } : null;
}

async function main() {
  const versions = await activeVersions();
  if (!versions) {
    console.warn('[backfill-consents] legal.terms_version / legal.privacy_version belum diisi. Skip.');
    return;
  }
  console.log(`[backfill-consents] versi aktif: terms=${versions.terms} privacy=${versions.privacy}`);

  // User aktif tanpa baris consent terms (privacy ikutinsert bareng).
  const pending = await db
    .select({ id: users.id })
    .from(users)
    .where(
      sql`${users.deletedAt} IS NULL AND NOT EXISTS (
        SELECT 1 FROM user_consents uc
        WHERE uc.user_id = ${users.id} AND uc.document_type = 'terms'
      )`,
    );
  console.log(`[backfill-consents] ${pending.length} user tanpa consent`);

  let inserted = 0;
  const now = new Date();
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const values = chunk.flatMap((u) => [
      {
        userId: u.id,
        documentType: 'terms' as const,
        documentVersion: versions.terms,
        acceptedAt: now,
        source: 'seed_backfill' as const,
      },
      {
        userId: u.id,
        documentType: 'privacy' as const,
        documentVersion: versions.privacy,
        acceptedAt: now,
        source: 'seed_backfill' as const,
      },
    ]);
    const res = await db.insert(userConsents).values(values).returning({ id: userConsents.id });
    inserted += res.length;
    console.log(`[backfill-consents] chunk ${i / CHUNK + 1}: +${res.length}`);
  }
  console.log(`[backfill-consents] selesai: ${inserted} baris consent ditulis`);
}

try {
  await main();
} finally {
  await closeDb();
}
