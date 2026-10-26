/**
 * Bersihkan makna duplikat lama (#174) - "asin, asin, asin".
 *
 * Duplikat = definisi + padanan sama setelah normalisasi (trim, lowercase,
 * collapse whitespace), beda kapital ikut dianggap sama. Yang dipertahankan:
 * baris dengan order_index terkecil. Sisanya di-soft-delete (deleted_at),
 * contoh kalimatnya ikut di-soft-delete.
 *
 * Idempoten. Default dry-run; pakai `--apply` untuk menulis.
 *
 * Jalankan:
 *   npm run db:dedupe-meanings            # lihat rencana
 *   npm run db:dedupe-meanings -- --apply # eksekusi
 */
import 'dotenv/config';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

// Import client SETELAH dotenv (client -> env.ts validasi).
const { db, closeDb } = await import('../shared/database/drizzle/client');
const { examples, meanings, meaningTranslations, words } = await import(
  '../shared/database/drizzle/schema'
);
const { rowMeaningFingerprint } = await import(
  '../modules/word/application/utils/meaning-deduplication'
);

const apply = process.argv.includes('--apply');

const rows = await db
  .select({
    id: meanings.id,
    wordId: meanings.wordId,
    lemma: words.lemma,
    definition: meanings.definition,
    isHaveDefinition: meanings.isHaveDefinition,
    isHaveTranslation: meanings.isHaveTranslation,
    orderIndex: meanings.orderIndex,
  })
  .from(meanings)
  .innerJoin(words, eq(words.id, meanings.wordId))
  .where(and(isNull(meanings.deletedAt), isNull(words.deletedAt)))
  .orderBy(asc(meanings.wordId), asc(meanings.orderIndex), asc(meanings.id));

const ids = rows.map((r) => r.id);
const translations =
  ids.length === 0
    ? []
    : await db
        .select({
          meaningId: meaningTranslations.meaningId,
          languageId: meaningTranslations.languageId,
          translationText: meaningTranslations.translationText,
        })
        .from(meaningTranslations)
        .where(
          and(inArray(meaningTranslations.meaningId, ids), isNull(meaningTranslations.deletedAt)),
        );

const trByMeaning = new Map<string, { languageId: string; translationText: string }[]>();
for (const t of translations) {
  const list = trByMeaning.get(t.meaningId) ?? [];
  list.push({ languageId: t.languageId, translationText: t.translationText });
  trByMeaning.set(t.meaningId, list);
}

const seenByWord = new Map<string, string>();
const duplicateIds: string[] = [];
const preview: string[] = [];
for (const row of rows) {
  const fp = rowMeaningFingerprint(row, trByMeaning.get(row.id) ?? []);
  if (seenByWord.get(row.wordId) === fp) {
    duplicateIds.push(row.id);
    preview.push(`  ${row.lemma} [${row.orderIndex}] ${row.definition}`);
    continue;
  }
  seenByWord.set(row.wordId, fp);
}

console.log(`[dedupe-meanings] ${duplicateIds.length} makna duplikat ditemukan`);
if (preview.length > 0) console.log(preview.slice(0, 50).join('\n'));

if (duplicateIds.length === 0) {
  await closeDb();
  process.exit(0);
}
if (!apply) {
  console.log('[dedupe-meanings] dry-run - jalankan dengan --apply untuk menulis');
  await closeDb();
  process.exit(0);
}

const now = new Date();
await db.transaction(async (tx) => {
  await tx
    .update(examples)
    .set({ deletedAt: now })
    .where(and(inArray(examples.meaningId, duplicateIds), isNull(examples.deletedAt)));
  await tx
    .update(meanings)
    .set({ deletedAt: now })
    .where(inArray(meanings.id, duplicateIds));
});

console.log(`[dedupe-meanings] ${duplicateIds.length} makna di-soft-delete`);
await closeDb();
