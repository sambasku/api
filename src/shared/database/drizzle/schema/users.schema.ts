import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

// Sesuai tabel `users` di DBML sumber
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    // Wire register pakai field `name` - disimpan di username (login by email)
    username: text('username').notNull().unique(),
    // Nama tampilan publik (boleh diedit). Nilai awal = username (backfill + save).
    // default '' hanya untuk insert test lama; toEntity fallback ke username.
    displayName: text('display_name').notNull().default(''),
    // Bio publik opsional (edit profil).
    bio: text('bio'),
    email: text('email').notNull().unique(),
    // Digit internasional tanpa '+', mis. 62899…; NULL kalau user skip.
    phone: text('phone'),
    // NULLABLE (Section 23): user OAuth-only tidak punya password.
    passwordHash: text('password_hash'),
    // Role dipindah ke tabel junction `user_roles` (0052) - satu user bisa
    // pegang banyak role. Field `role` di wire API tetap dikirim (deprecated,
    // derived tertinggi dari roles).
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    // false = akun boleh masuk dan membaca, tetapi tidak boleh mengirim UGC tulis
    // (kata/media/usul ubah, komentar, diskusi). Admin "Hentikan kontribusi".
    canContribute: integer('can_contribute', { mode: 'boolean' }).notNull().default(true),
    /** Mute sementara dari policy abuse; null = tidak di-mute. */
    contributeMutedUntil: integer('contribute_muted_until', { mode: 'timestamp' }),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    /** Waktu akun terverifikasi (OTP sukses); null = belum / data lama. */
    emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
    /** Waktu user tap "Mengerti" di guide swipe halaman kontribusi; null = belum baca. */
    readContributionGuideAt: integer('read_contribution_guide_at', { mode: 'timestamp' }),
    // Avatar publik (GitHub sambasku/images). Null = belum set.
    avatarUrl: text('avatar_url'),
    avatarProvider: text('avatar_provider'),
    avatarProviderFileId: text('avatar_provider_file_id'),
    avatarSha: text('avatar_sha'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    /** Piggyback presence: di-touch dari request authenticated (throttle 5 mnt). */
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('users_phone_unique').on(t.phone).where(sql`phone is not null`),
    index('users_last_seen_at_idx').on(t.lastSeenAt),
  ],
);

// Junction multi role (0052). PK composite (user_id, role) = satu role sekali
// per user; index user_id untuk attach saat load, index role untuk filter/list.
export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    index('user_roles_user_id_idx').on(t.userId),
    index('user_roles_role_idx').on(t.role),
  ],
);
