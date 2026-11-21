import 'dotenv/config';
import { eq, isNull } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import {
  categories,
  dialects,
  languages,
  leaderboardExcludedUsers,
  userRoles,
  users,
  wordClasses,
} from '@/shared/database/drizzle/schema';
import { SYSTEM_USER_IDS } from '@/shared/constants/system-users';
import { Pbkdf2PasswordService } from '@/modules/auth/infrastructure/pbkdf2-password.service';
import { logger } from '@/shared/logging/logger';
import { ANONIM_EMAIL, ANONIM_USER_ID, ANONIM_USERNAME } from '@/shared/constants/anonim';
import {
  CSV_IMPORTER_DISPLAY_NAME,
  CSV_IMPORTER_EMAIL,
  CSV_IMPORTER_USER_ID,
  CSV_IMPORTER_USERNAME,
} from '@/shared/constants/csv-importer';
import {
  GITHUB_ACTIONS_DISPLAY_NAME,
  GITHUB_ACTIONS_EMAIL,
  GITHUB_ACTIONS_USER_ID,
  GITHUB_ACTIONS_USERNAME,
} from '@/shared/constants/github-actions';
import {
  WEB_IMPORT_DISPLAY_NAME,
  WEB_IMPORT_EMAIL,
  WEB_IMPORT_USER_ID,
  WEB_IMPORT_USERNAME,
} from '@/shared/constants/web-importer';
import {
  VOTING_WARGA_DISPLAY_NAME,
  VOTING_WARGA_EMAIL,
  VOTING_WARGA_USER_ID,
  VOTING_WARGA_USERNAME,
} from '@/shared/constants/voting-warga';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { seedAchievements } from './seed-achievements';

const SEED_LANGUAGES = [
  { code: 'SBS', name: 'Sambas', nativeName: 'Sambas' },
  { code: 'IDN', name: 'Indonesia', nativeName: 'Bahasa Indonesia' },
] as const;

const SEED_DIALECTS = [
  { languageCode: 'SBS', code: 'umum', name: 'Umum', isDefault: true },
  { languageCode: 'SBS', code: 'kota', name: 'Sambas Kota', isDefault: false },
  { languageCode: 'SBS', code: 'pesisir', name: 'Sambas Pesisir', isDefault: false },
] as const;

const SEED_WORD_CLASSES = [
  { code: 'n', name: 'Nomina', alias: 'Kata Benda', description: 'noun - kata yang menyebut orang, benda, tempat, atau konsep' },
  { code: 'v', name: 'Verba', alias: 'Kata Kerja', description: 'verb - kata yang menyatakan perbuatan atau tindakan' },
  { code: 'adj', name: 'Adjektiva', alias: 'Kata Sifat', description: 'adjective - kata yang menjelaskan sifat, keadaan, atau jumlah' },
  { code: 'adv', name: 'Adverbia', alias: 'Kata Keterangan', description: 'adverb - kata yang menjelaskan verba/adjektiva (waktu, tempat, cara, derajat)' },
  { code: 'pron', name: 'Pronomina', alias: 'Kata Ganti', description: 'pronoun - kata pengganti nomina (saya, kamu, dia, ini)' },
  { code: 'num', name: 'Numeralia', alias: 'Kata Bilangan', description: 'numeral - kata yang menyatakan jumlah atau urutan (satu, kedua)' },
  { code: 'prep', name: 'Preposisi', alias: 'Kata Depan', description: 'preposition - kata sebelum nomina (di, ke, dari, pada)' },
  { code: 'konj', name: 'Konjungsi', alias: 'Kata Sambung', description: 'conjunction - kata penghubung kata/klausa/kalimat (dan, tetapi, karena)' },
  { code: 'interj', name: 'Interjeksi', alias: 'Kata Seru', description: 'interjection - kata seru perasaan spontan (aduh, wah, hore)' },
  { code: 'art', name: 'Artikula', alias: 'Kata Sandang', description: 'article - kata pembatas nomina (si, sang)' },
  { code: 'part', name: 'Partikel', alias: 'Kata Tugas', description: 'particle - kata penegas, penanya, atau pembantu (kah, lah, pun)' },
  { code: 'umum', name: 'Umum', alias: 'Belum Diketahui', description: 'generic - dipilih saat kelas kata belum diketahui atau tidak yakin' },
] as const;

const SEED_CATEGORIES = [
  { name: 'Kekerabatan' },
  { name: 'Alam' },
  { name: 'Makanan' },
  { name: 'Buah-buahan' },
  { name: 'Binatang & Hewan' },
  { name: 'Tumbuhan & Tanaman' },
  { name: 'Tubuh & Kesehatan' },
  { name: 'Pakaian & Aksesori' },
  { name: 'Rumah & Bangunan' },
  { name: 'Pertanian & Perkebunan' },
  { name: 'Perikanan & Kelautan' },
  { name: 'Alat & Perkakas' },
  { name: 'Transportasi' },
  { name: 'Warna' },
  { name: 'Waktu & Musim' },
  { name: 'Cuaca' },
  { name: 'Geografi & Tempat' },
  { name: 'Seni & Budaya' },
  { name: 'Adat & Tradisi' },
  { name: 'Agama & Kepercayaan' },
  { name: 'Pekerjaan & Profesi' },
  { name: 'Aktivitas Harian' },
  { name: 'Sifat & Perasaan' },
  { name: 'Ekonomi & Perdagangan' },
  { name: 'Angka & Ukuran' },
  { name: 'Permainan & Hiburan' },
] as const;

/**
 * Seed referensi + user sistem.
 * Insert-if-missing saja - baris yang sudah ada tidak diubah (aman staging/prod).
 */
export async function seedReference(): Promise<void> {
  const hasher = new Pbkdf2PasswordService();

  // User sistem - password acak hanya saat insert pertama; skip jika id sudah ada.
  // username = handle slug; displayName = label manusiawi (join feed/console).
  await db
    .insert(users)
    .values({
      id: ANONIM_USER_ID,
      username: ANONIM_USERNAME,
      displayName: ANONIM_USERNAME,
      email: ANONIM_EMAIL,
      passwordHash: await hasher.hash(crypto.randomUUID()),
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.id });
  // Email/username boleh berganti lewat konstanta; password dan id tetap.
  await db
    .update(users)
   .set({
      username: ANONIM_USERNAME,
      displayName: ANONIM_USERNAME,
      email: ANONIM_EMAIL,
    })
    .where(eq(users.id, ANONIM_USER_ID));
  logger.info(`Seed referensi: user sistem ${ANONIM_EMAIL}`);

  await db
    .insert(users)
    .values({
      id: CSV_IMPORTER_USER_ID,
      username: CSV_IMPORTER_USERNAME,
      displayName: CSV_IMPORTER_DISPLAY_NAME,
      email: CSV_IMPORTER_EMAIL,
      passwordHash: await hasher.hash(crypto.randomUUID()),
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.id });
  // Nama tampilan/email boleh berganti; password dan id tetap.
  await db
    .update(users)
   .set({
      username: CSV_IMPORTER_USERNAME,
      displayName: CSV_IMPORTER_DISPLAY_NAME,
      email: CSV_IMPORTER_EMAIL,
    })
    .where(eq(users.id, CSV_IMPORTER_USER_ID));
  logger.info(`Seed referensi: user sistem ${CSV_IMPORTER_EMAIL}`);

  await db
    .insert(users)
    .values({
      id: GITHUB_ACTIONS_USER_ID,
      username: GITHUB_ACTIONS_USERNAME,
      displayName: GITHUB_ACTIONS_DISPLAY_NAME,
      email: GITHUB_ACTIONS_EMAIL,
      passwordHash: await hasher.hash(crypto.randomUUID()),
      emailVerified: true,
    })
   .onConflictDoNothing({ target: users.id });
  await db
    .update(users)
    .set({
      username: GITHUB_ACTIONS_USERNAME,
      displayName: GITHUB_ACTIONS_DISPLAY_NAME,
      email: GITHUB_ACTIONS_EMAIL,
    })
    .where(eq(users.id, GITHUB_ACTIONS_USER_ID));
  logger.info(`Seed referensi: user sistem ${GITHUB_ACTIONS_EMAIL}`);

  // User sistem Web Importer
  await db
    .insert(users)
    .values({
      id: WEB_IMPORT_USER_ID,
      username: WEB_IMPORT_USERNAME,
      displayName: WEB_IMPORT_DISPLAY_NAME,
      email: WEB_IMPORT_EMAIL,
      passwordHash: await hasher.hash(crypto.randomUUID()),
      emailVerified: true,
    })
   .onConflictDoNothing({ target: users.id });
  await db
    .update(users)
    .set({
      username: WEB_IMPORT_USERNAME,
      displayName: WEB_IMPORT_DISPLAY_NAME,
      email: WEB_IMPORT_EMAIL,
    })
    .where(eq(users.id, WEB_IMPORT_USER_ID));
  logger.info(`Seed referensi: user sistem ${WEB_IMPORT_EMAIL}`);

  // User sistem Voting Warga (atribusi auto-verif makna dari quorum vote).
  await db
    .insert(users)
    .values({
      id: VOTING_WARGA_USER_ID,
      username: VOTING_WARGA_USERNAME,
      displayName: VOTING_WARGA_DISPLAY_NAME,
      email: VOTING_WARGA_EMAIL,
      passwordHash: await hasher.hash(crypto.randomUUID()),
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.id });
  await db
    .update(users)
    .set({
      username: VOTING_WARGA_USERNAME,
      displayName: VOTING_WARGA_DISPLAY_NAME,
      email: VOTING_WARGA_EMAIL,
    })
    .where(eq(users.id, VOTING_WARGA_USER_ID));
  logger.info(`Seed referensi: user sistem ${VOTING_WARGA_EMAIL}`);

  // Multi role: user sistem pegang role contributor di junction.
  await db
    .insert(userRoles)
    .values(SYSTEM_USER_IDS.map((userId) => ({ userId, role: 'contributor' as const })))
    .onConflictDoNothing();

  await db
    .insert(leaderboardExcludedUsers)
    .values(SYSTEM_USER_IDS.map((userId) => ({ userId, note: 'Akun sistem bawaan' })))
    .onConflictDoNothing();

  // Insert-if-missing (bukan ON CONFLICT target kolom): Turso/SQLite sering
  // menolak `ON CONFLICT ("languages"."code")` walau unique index ada
  // ("does not match any PRIMARY KEY or UNIQUE constraint").
  const existingLangCodes = new Set(
    (await db.select({ code: languages.code }).from(languages)).map((r) => r.code),
  );
  const missingLangs = SEED_LANGUAGES.filter((l) => !existingLangCodes.has(l.code));
  if (missingLangs.length > 0) {
    await db.insert(languages).values([...missingLangs]);
  }

  const smbLanguage = await db.query.languages.findFirst({ where: (l, { eq }) => eq(l.code, 'SBS') });
  if (!smbLanguage) {
    throw new Error('Bahasa SBS belum ada setelah seed languages');
  }

  const existingDialectCodes = new Set(
    (
      await db
        .select({ code: dialects.code })
        .from(dialects)
        .where(eq(dialects.languageId, smbLanguage.id))
    ).map((r) => r.code),
  );
  const missingDialects = SEED_DIALECTS.filter((d) => !existingDialectCodes.has(d.code));
  if (missingDialects.length > 0) {
    await db.insert(dialects).values(
      missingDialects.map((d) => ({
        languageId: smbLanguage.id,
        code: d.code,
        name: d.name,
        isDefault: d.isDefault,
      })),
    );
  }

  const existingWordClassCodes = new Set(
    (await db.select({ code: wordClasses.code }).from(wordClasses)).map((r) => r.code),
  );
  const missingWordClasses = SEED_WORD_CLASSES.filter((wc) => !existingWordClassCodes.has(wc.code));
  if (missingWordClasses.length > 0) {
    await db.insert(wordClasses).values([...missingWordClasses]);
  }

  const existingCategoryNames = new Set(
    (await db.select({ name: categories.name }).from(categories).where(isNull(categories.deletedAt))).map(
      (r) => r.name,
    ),
  );
  const missingCategories = SEED_CATEGORIES.filter((cat) => !existingCategoryNames.has(cat.name));
  if (missingCategories.length > 0) {
    await db.insert(categories).values(missingCategories);
  }

  logger.info(
    `Seed referensi: bahasa ${missingLangs.length}/${SEED_LANGUAGES.length} baru, dialek ${missingDialects.length}/${SEED_DIALECTS.length} baru, kelas kata ${missingWordClasses.length}/${SEED_WORD_CLASSES.length} baru, kategori ${missingCategories.length}/${SEED_CATEGORIES.length} baru`,
  );
  // Katalog achievement (angkatan-ke-1, beta-tester) - idempoten, pisah
  // fungsi tapi sekali jalan bareng referensi biar satu workflow saja.
  await seedAchievements();
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  seedReference()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error(err, 'Seed reference gagal - pastikan database up dan sudah dimigrate');
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
