/**
 * Backfill `translations` dari contoh lemma yang sudah punya terjemahan
 * kalimat (`examples.target_sentence`).
 *
 * - reff = `lemma_example`, reff_id = examples.id
 * - status = accepted (auto-promote, sama verifikator buat/approve)
 * - Idempoten lewat TranslationRepository.upsertAccepted
 * - Skip: tidak published, tanpa target, tanpa created_by (FK users)
 *
 * Jalankan: pnpm db:backfill-lemma-example-translations
 * (DATABASE_URL harus menunjuk DB target).
 *
 * GitHub Actions: workflow `backfill-lemma-example-translations.yml`
 * (workflow_dispatch → staging | production).
 */
import 'dotenv/config';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { examples, LEMMA_EXAMPLE_TRANSLATION_REFF } =
  await import('../shared/database/drizzle/schema');
const { TranslationRepositoryImpl } =
  await import('../modules/translation/infrastructure/translation.repository.impl');

const CHUNK = 100;

async function main() {
  console.log('[backfill-lemma-example-translations] mulai');

  const raw = await db
    .select({
      id: examples.id,
      sourceSentence: examples.sourceSentence,
      targetSentence: examples.targetSentence,
      createdBy: examples.createdBy,
      updatedBy: examples.updatedBy,
    })
    .from(examples)
    .where(
      and(
        isNull(examples.deletedAt),
        eq(examples.status, 'published'),
        isNotNull(examples.targetSentence),
      ),
    );

  const rows = raw.filter(
    (r) =>
      r.sourceSentence.trim().length > 0 &&
      (r.targetSentence ?? '').trim().length > 0,
  );

  console.log(
    `[backfill-lemma-example-translations] kandidat=${rows.length} (raw=${raw.length}) reff=${LEMMA_EXAMPLE_TRANSLATION_REFF}`,
  );

  const repo = new TranslationRepositoryImpl(db);
  let ok = 0;
  let skippedNoActor = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    for (const row of chunk) {
      const source = row.sourceSentence.trim();
      const target = (row.targetSentence ?? '').trim();
      const actorId = row.createdBy ?? row.updatedBy;
      if (!actorId) {
        skippedNoActor += 1;
        continue;
      }
      try {
        await repo.upsertAccepted({
          reff: LEMMA_EXAMPLE_TRANSLATION_REFF,
          reffId: row.id,
          sourceBody: source,
          body: target,
          translatorId: actorId,
          reviewerId: actorId,
        });
        ok += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `[backfill-lemma-example-translations] gagal example=${row.id}`,
          err,
        );
      }
    }
    console.log(
      `[backfill-lemma-example-translations] progress ${Math.min(i + CHUNK, rows.length)}/${rows.length}`,
    );
  }

  console.log(
    `[backfill-lemma-example-translations] selesai ok=${ok} skipped_no_actor=${skippedNoActor} failed=${failed}`,
  );
}

try {
  await main();
} catch (err) {
  console.error('[backfill-lemma-example-translations] gagal', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
