import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '@/shared/database/drizzle/client';
import { achievements } from '@/shared/database/drizzle/schema';
import { logger } from '@/shared/logging/logger';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/**
 * Seed katalog achievement (idempotent ON CONFLICT code DO NOTHING).
 *
 * Kohort V1 + warm-up R1/G3 (ACHIEVEMENT_ENHANCEMENT G2):
 * kontribusi kata tier, suara, contoh, verifikasi, komentar, diskusi.
 * Plus bingkai role staf (`istana-alwatzikhoebillah` = reviewer/admin/root).
 *
 * Award TIDAK diberikan di sini - jalankan Scan di console / cron /
 * `pnpm scan:achievements` untuk backfill.
 */
const CDN = 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/achievements';

const SEED_ACHIEVEMENTS: Array<{
  code: string;
  title: string;
  description: string;
  category: string;
  rewardType: 'profile_border' | 'badge' | 'sticker';
  badgeUrl: string | null;
  criteria: Record<string, unknown>;
  family?: string | null;
  level?: number | null;
}> = [
  {
    code: 'angkatan-ke-1',
    title: 'Angkatan Ke-1',
    description: 'Terdaftar sebagai pengguna SambasKu pada angkatan pertama',
    category: 'kohort',
    rewardType: 'profile_border',
    badgeUrl: `${CDN}/angkatan-ke-1.png`,
    criteria: {
      source: 'registration',
      window: { from: '2026-01-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' },
    },
  },
  {
    code: 'istana-alwatzikhoebillah',
    title: 'Istana Alwatzikhoebillah',
    description:
      'Bingkai khusus untuk verifikator, admin, dan root (bukan kontributor saja)',
    category: 'kualitas',
    rewardType: 'profile_border',
    badgeUrl: `${CDN}/istana-alwatzikhoebillah.png`,
    criteria: {
      source: 'user_role',
      filters: { role_in: 'reviewer,admin,root' },
    },
  },
  {
    code: 'beta-tester',
    title: 'Beta Tester',
    description: 'Pengguna awal yang mengikuti fase closed testing',
    category: 'kohort',
    rewardType: 'badge',
    badgeUrl: `${CDN}/beta-tester.png`,
    criteria: {
      source: 'registration',
      window: { from: '2024-01-01T00:00:00+07:00', to: '2026-10-13T00:00:00+07:00' },
    },
  },
  {
    code: 'kata-pertama',
    title: 'Kata Pertama',
    description: 'Satu usulan kata yang disetujui',
    category: 'kontribusi',
    rewardType: 'badge',
    badgeUrl: `${CDN}/kata-pertama.png`,
    criteria: {
      source: 'contributions_approved',
      threshold: 1,
      filters: { entity_type: 'word' },
    },
    family: 'kata-disetujui',
    level: 1,
  },
  {
    code: 'kata-panjang',
    title: 'Kata Panjang',
    description: 'Sepuluh usulan kata yang disetujui',
    category: 'kontribusi',
    rewardType: 'badge',
    badgeUrl: `${CDN}/kata-panjang.png`,
    criteria: {
      source: 'contributions_approved',
      threshold: 10,
      filters: { entity_type: 'word' },
    },
    family: 'kata-disetujui',
    level: 2,
  },
  {
    code: 'kata-tokoh',
    title: 'Kata Tokoh',
    description: 'Lima puluh usulan kata yang disetujui',
    category: 'kontribusi',
    rewardType: 'badge',
    badgeUrl: `${CDN}/kata-tokoh.png`,
    criteria: {
      source: 'contributions_approved',
      threshold: 50,
      filters: { entity_type: 'word' },
    },
    family: 'kata-disetujui',
    level: 3,
  },
  {
    code: 'suara-penutur',
    title: 'Suara Penutur',
    description: 'Lima pelafalan yang disetujui',
    category: 'kontribusi',
    rewardType: 'badge',
    badgeUrl: `${CDN}/suara-penutur.png`,
    criteria: {
      source: 'contributions_approved',
      threshold: 5,
      filters: { entity_type: 'pronunciation' },
    },
    family: 'suara-penutur',
    level: 1,
  },
  {
    code: 'contoh-berguna',
    title: 'Contoh Berguna',
    description: 'Sepuluh contoh kalimat yang disetujui',
    category: 'kontribusi',
    rewardType: 'badge',
    badgeUrl: `${CDN}/contoh-berguna.png`,
    criteria: {
      source: 'contributions_approved',
      threshold: 10,
      filters: { entity_type: 'example' },
    },
    family: 'contoh-berguna',
    level: 1,
  },
  {
    code: 'penjaga-pintu',
    title: 'Penjaga Pintu',
    description: 'Dua puluh lima keputusan verifikasi',
    category: 'kualitas',
    rewardType: 'badge',
    badgeUrl: `${CDN}/penjaga-pintu.png`,
    criteria: { source: 'verifications_done', threshold: 25 },
    family: 'penjaga',
    level: 1,
  },
  {
    code: 'penjaga-agung',
    title: 'Penjaga Agung',
    description: 'Dua ratus lima puluh keputusan verifikasi',
    category: 'kualitas',
    rewardType: 'badge',
    badgeUrl: `${CDN}/penjaga-agung.png`,
    criteria: { source: 'verifications_done', threshold: 250 },
    family: 'penjaga',
    level: 2,
  },
  {
    code: 'bercakap',
    title: 'Bercakap',
    description: 'Sepuluh komentar yang tayang',
    category: 'komunitas',
    rewardType: 'badge',
    badgeUrl: `${CDN}/bercakap.png`,
    criteria: { source: 'comments_published', threshold: 10 },
    family: 'bercakap',
    level: 1,
  },
  {
    code: 'betanyar',
    title: 'Betanyar',
    description: 'Tiga ruang diskusi yang disetujui',
    category: 'komunitas',
    rewardType: 'badge',
    badgeUrl: `${CDN}/betanyar.png`,
    criteria: { source: 'discussions_created', threshold: 3 },
    family: 'betanyar',
    level: 1,
  },
  {
    code: 'penyambung',
    title: 'Penyambung',
    description: 'Dua puluh balasan diskusi yang tayang',
    category: 'komunitas',
    rewardType: 'badge',
    badgeUrl: `${CDN}/penyambung.png`,
    criteria: { source: 'discussion_replies_published', threshold: 20 },
    family: 'penyambung',
    level: 1,
  },
  {
    code: 'peringkat-juara',
    title: 'Juara Mingguan',
    description: 'Pernah juara papan peringkat minggu (rank 1)',
    category: 'momen',
    rewardType: 'badge',
    badgeUrl: `${CDN}/peringkat-juara.png`,
    criteria: {
      source: 'leaderboard_top',
      filters: { rank_min: '1', rank_max: '1' },
    },
    family: 'peringkat-mingguan',
    level: 4,
  },
  {
    code: 'peringkat-tiga-besar',
    title: 'Tiga Besar Mingguan',
    description: 'Pernah rank 2 atau 3 di papan peringkat minggu',
    category: 'momen',
    rewardType: 'badge',
    badgeUrl: `${CDN}/peringkat-tiga-besar.png`,
    criteria: {
      source: 'leaderboard_top',
      filters: { rank_min: '2', rank_max: '3' },
    },
    family: 'peringkat-mingguan',
    level: 3,
  },
  {
    code: 'peringkat-sepuluh',
    title: 'Sepuluh Besar Mingguan',
    description: 'Pernah rank 4 sampai 10 di papan peringkat minggu',
    category: 'momen',
    rewardType: 'badge',
    badgeUrl: `${CDN}/peringkat-sepuluh.png`,
    criteria: {
      source: 'leaderboard_top',
      filters: { rank_min: '4', rank_max: '10' },
    },
    family: 'peringkat-mingguan',
    level: 2,
  },
  {
    code: 'peringkat-papan',
    title: 'Masuk Papan Mingguan',
    description: 'Pernah rank 11 sampai 30 di papan peringkat minggu',
    category: 'momen',
    rewardType: 'badge',
    badgeUrl: `${CDN}/peringkat-papan.png`,
    criteria: {
      source: 'leaderboard_top',
      filters: { rank_min: '11', rank_max: '30' },
    },
    family: 'peringkat-mingguan',
    level: 1,
  },
];

export async function seedAchievements() {
  let inserted = 0;
  for (const item of SEED_ACHIEVEMENTS) {
    // Select-then-insert: hindari ON CONFLICT(target) Drizzle yang emit
    // `ON CONFLICT ("achievements"."code")` - LibSQL/SQLite menolak
    // conflict target berkualifikasi tabel (error: does not match UNIQUE).
    const existing = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(eq(achievements.code, item.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(achievements).values({
        code: item.code,
        title: item.title,
        description: item.description,
        category: item.category,
        rewardType: item.rewardType,
        badgeUrl: item.badgeUrl,
        criteria: JSON.stringify(item.criteria),
        family: item.family ?? null,
        level: item.level ?? null,
        isActive: true,
      });
      inserted += 1;
      continue;
    }

    // Sinkronisasi aset/kriteria bila baris sudah ada (idempotent re-run):
    // update NON-kritis saja supaya re-run tidak menimpa katalog yang sudah
    // dikurasi admin (title/description/is_active dibiarkan).
    await db
      .update(achievements)
      .set({
        badgeUrl: item.badgeUrl,
        criteria: JSON.stringify(item.criteria),
        family: item.family ?? null,
        level: item.level ?? null,
        updatedAt: new Date(),
      })
      .where(eq(achievements.code, item.code));
  }
  logger.info(`Seed achievements: ${inserted} baru, total katalog ${SEED_ACHIEVEMENTS.length}`);
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  seedAchievements()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error(err, 'Seed achievements gagal - pastikan database up dan sudah dimigrate');
      await closeDb().catch(() => {});
      process.exit(1);
    });
}
