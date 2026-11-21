/**
 * Backfill: turunkan words.is_verified yang tidak punya makna published
 * verified (invariant trust-makna: word verified iff SEMUA makna published
 * verified). Kata kena = lemma tayang kosong tanpa makna.
 *
 * - Idempoten: hanya menyentuh is_verified=1 tanpa makna verified.
 * - Dry run: DRY_RUN=1 (default) hanya menghitung + sampel lemma.
 *
 * Jalankan: pnpm db:backfill-unverify-empty-words
 * (DATABASE_URL harus menunjuk DB target).
 *
 * GitHub Actions: workflow `backfill-unverify-empty-words.yml`
 * (workflow_dispatch → staging | production).
 */
import 'dotenv/config';
import { and, eq, isNull, notExists, sql } from 'drizzle-orm';

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { words, meanings } = await import('../shared/database/drizzle/schema');

const noVerifiedMeaning = notExists(
  db
    .select({ one: sql`1` })
    .from(meanings)
    .where(
      and(
        eq(meanings.wordId, words.id),
        eq(meanings.status, 'published'),
        eq(meanings.isVerified, true),
        isNull(meanings.deletedAt),
      ),
    ),
);

async function main() {
  const dryRun = process.env.DRY_RUN !== '0';
  console.log(`[backfill-unverify-empty-words] mulai dry_run=${dryRun}`);

  const affected = db
    .select({ id: words.id })
    .from(words)
    .where(
      and(
        eq(words.isVerified, true),
        eq(words.status, 'published'),
        isNull(words.deletedAt),
        noVerifiedMeaning,
      ),
    );

  const rows = await affected;
  console.log(`[backfill-unverify-empty-words] kandidat=${rows.length}`);

  const lemmas = await db
    .select({ id: words.id, lemma: words.lemma })
    .from(words)
    .where(
      and(
        eq(words.isVerified, true),
        eq(words.status, 'published'),
        isNull(words.deletedAt),
        noVerifiedMeaning,
      ),
    )
    .limit(20);
  for (const w of lemmas) console.log(`  - ${w.lemma} (${w.id})`);

  if (dryRun) {
    console.log('[backfill-unverify-empty-words] DRY_RUN: tidak mengubah data. Set DRY_RUN=0 untuk eksekusi.');
    return;
  }

  const updated = await db
    .update(words)
    .set({
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      updatedBy: 'system-backfill',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(words.isVerified, true),
        eq(words.status, 'published'),
        isNull(words.deletedAt),
        noVerifiedMeaning,
      ),
    )
    .returning({ id: words.id });
  console.log(`[backfill-unverify-empty-words] selesai updated=${updated.length}`);
}

try {
  await main();
} catch (err) {
  console.error('[backfill-unverify-empty-words] gagal', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
