/**
 * Gabung entri yang hanya beda kapital/spasi, lalu lipat lemma hidup ke
 * trim + lowercase.
 *
 * Default dry-run. `--apply` menulis. Jangan jalankan `--apply` ke produksi
 * tanpa cek dry-run.
 *
 *   npm run db:fold-lemma-case
 *   npm run db:fold-lemma-case -- --apply
 */
import 'dotenv/config';
import { and, eq, isNull, sql } from 'drizzle-orm';

const apply = process.argv.includes('--apply');

const { db, closeDb } = await import('../shared/database/drizzle/client');
const { userRoles, words } = await import('../shared/database/drizzle/schema');
const { planLemmaCaseMerges } = await import('../modules/word/application/plan-lemma-case-merge');
const { normalizeLemma } = await import('../modules/word/application/utils/normalize-lemma');
const { mergeDuplicateWordsInTx } = await import(
  '../modules/word/infrastructure/merge-duplicate-words'
);

const stored = await db
  .select({
    id: words.id,
    languageId: words.languageId,
    lemma: words.lemma,
    createdAt: words.createdAt,
  })
  .from(words)
  .where(isNull(words.deletedAt));

const rows = stored.map((row) => ({
  id: row.id,
  languageId: row.languageId,
  lemma: row.lemma,
  createdAt: row.createdAt.getTime(),
}));
const groups = planLemmaCaseMerges(rows);
const foldCount = rows.filter((row) => row.lemma !== normalizeLemma(row.lemma)).length;

console.log(`[fold-lemma-case] ${groups.length} kelompok beda kapital, ${foldCount} lemma belum dilipat`);
for (const group of groups.slice(0, 30)) {
  console.log(`  ${group.lemma} simpan ${group.keepId} gabung ${group.mergeIds.length}`);
}
if (groups.length > 30) console.log(`  ... ${groups.length - 30} kelompok lagi`);

if (!apply) {
  console.log('[fold-lemma-case] dry-run. Tambah --apply untuk menulis.');
  await closeDb();
  process.exit(0);
}

let actorId: string | null = null;
if (groups.length > 0) {
  for (const role of ['root', 'admin']) {
    const [actor] = await db
      .select({ id: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, role))
      .limit(1);
    if (actor) {
      actorId = actor.id;
      break;
    }
  }
  if (!actorId) {
    console.error('[fold-lemma-case] tidak ada user root/admin untuk jejak penggabungan');
    await closeDb();
    process.exit(1);
  }
  for (const group of groups) {
    await db.transaction((tx) =>
      mergeDuplicateWordsInTx(tx, group.keepId, group.mergeIds, actorId!),
    );
  }
}

const folded = await db
  .update(words)
  .set({
    lemma: sql`lower(trim(${words.lemma}))`,
    ...(actorId ? { updatedBy: actorId } : {}),
    updatedAt: new Date(),
  })
  .where(and(isNull(words.deletedAt), sql`${words.lemma} != lower(trim(${words.lemma}))`))
  .returning({ id: words.id });

console.log(
  `[fold-lemma-case] ${groups.length} kelompok digabung, ${folded.length} lemma dilipat`,
);
await closeDb();
