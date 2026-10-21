import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/**
 * Katalog reward (master border / badge / stiker). Satu tabel untuk semua
 * jenis reward: `rewardType` yang membedakan, bukan tabel master terpisah.
 *
 * Kriteria disimpan sebagai JSON yang divalidasi Zod terhadap registry
 * source (`achievement-registry.ts`), bukan grammar bebas: SQL evaluator
 * tetap fixed + terindeks, dan menambah source baru (kuis, dst.) tidak
 * mengubah tabel ini.
 *
 * - `code` slug stabil (dipakai integrasi), tidak boleh berubah sembarangan.
 * - `family` + `level` = tier (mis. 10/50/100 kata); NULL = tanpa tier.
 * - `isActive = false` = berhenti diajukan; award lama tetap.
 */
export const achievements = sqliteTable(
  'achievements',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** 'kohort' | 'kontribusi' | 'komunitas' | 'kualitas' | 'momen' */
    category: text('category').notNull(),
    /** 'profile_border' | 'badge' | 'sticker' */
    rewardType: text('reward_type').notNull(),
    /** Aset reward (jsDelivr `sambasku/images`): bingkai border / lencana / stiker. */
    badgeUrl: text('badge_url'),
    /** JSON criteria - divalidasi Zod terhadap registry source. */
    criteria: text('criteria').notNull(),
    family: text('family'),
    level: integer('level'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('achievements_code_unique').on(t.code),
    index('achievements_active_idx').on(t.isActive),
    index('achievements_reward_type_idx').on(t.rewardType),
  ],
);

/**
 * Fakta penganugerahan (sumber kebenaran "user X punya reward Y").
 * Satu baris = satu reward dimiliki; jenis reward dibaca dari katalog.
 * UNIQUE (achievement_id, user_id) = penganugerahan idempotent.
 *
 * `grantedVia`: 'scan' (mesin evaluasi) | 'admin' (grant manual).
 * `context`: snapshot saat award (mis. `{"registered_at": "..."}`).
 */
export const userAchievements = sqliteTable(
  'user_achievements',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievements.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    awardedAt: integer('awarded_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    grantedVia: text('granted_via', { enum: ['scan', 'admin'] }).notNull(),
    context: text('context'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    deletedBy: text('deleted_by').references(() => users.id),
  },
  (t) => [
    // Idempotensi: scan/grant berulang tidak membuat baris dobel.
    uniqueIndex('user_achievements_unique').on(t.achievementId, t.userId),
    index('user_achievements_user_idx').on(t.userId),
    // Anti-join scan: cari award yang belum ada per achievement.
    index('user_achievements_achievement_idx').on(t.achievementId),
  ],
);

/** Tipe reward - satu katalog, beda tampilan di client. */
export const REWARD_TYPES = ['profile_border', 'badge', 'sticker'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

/** Kategori katalog (grup tampilan admin/profil). */
export const ACHIEVEMENT_CATEGORIES = [
  'kohort',
  'kontribusi',
  'komunitas',
  'kualitas',
  'momen',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_GRANTED_VIA = ['scan', 'admin'] as const;

/** Ekspresi SQL kolom JSON criteria (dipakai query builder bila perlu). */
export const achievementCriteriaSql = sql`${achievements.criteria}`;
