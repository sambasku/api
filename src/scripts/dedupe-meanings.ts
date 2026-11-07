/**
 * Gabung makna duplikat yang sudah ada, lalu isi dedupe_key.
 *
 * Duplikat = kelas kata + definisi + seluruh padanan, setelah normalisasi.
 * Pemenang = createdAt paling lama, seri vote terbanyak, lalu id terkecil.
 * Default dry-run. `--apply` menulis (contoh dipindah, vote digabung, pecundang
 * di-soft-delete). Jangan jalankan `--apply` ke produksi tanpa cek dry-run.
 *
 *   npm run db:dedupe-meanings
 *   npm run db:dedupe-meanings -- --apply
 */
import 'dotenv/config';

const apply = process.argv.includes('--apply');

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { applySafeMeaningMerges, loadMergeMeaningRows, planSafeMeaningMerges } = await import(
  '../modules/word/application/merge-duplicate-meanings'
);

const rows = await loadMergeMeaningRows(db);
const groups = planSafeMeaningMerges(rows);
const lemmaByWord = new Map(rows.map((row) => [row.wordId, row.lemma]));

console.log(`[dedupe-meanings] ${groups.length} kelompok aman`);
for (const group of groups.slice(0, 30)) {
  const lemma = lemmaByWord.get(group.wordId) ?? group.wordId;
  console.log(`  ${lemma} pemenang ${group.winnerId} pecundang ${group.loserIds.length}`);
}
if (groups.length > 30) console.log(`  ... ${groups.length - 30} kelompok lagi`);

if (!apply) {
  console.log('[dedupe-meanings] dry-run. Tambah --apply untuk menulis.');
  await closeDb();
  process.exit(0);
}

const result = await applySafeMeaningMerges(db);
console.log(
  `[dedupe-meanings] ${result.groups} kelompok digabung, ${result.closedSuggestions} usulan ditutup`,
);
await closeDb();
