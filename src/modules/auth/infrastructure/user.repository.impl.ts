import { and, desc, eq, inArray, isNull, like, or, lt, sql } from 'drizzle-orm';
import { users, userRoles } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { NotFoundError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { UserRepository } from '../domain/repositories/user.repository';
import type { NewUser, User, UserListFilter, UserRole } from '../domain/entities/user.entity';
import { derivePrimaryRole } from '../domain/entities/user.entity';

type UserRow = typeof users.$inferSelect;

/** Role milik sekumpulan user - 1 query, hindari N+1. */
async function loadRolesByUserIds(db: AppDatabase, ids: string[]): Promise<Map<string, UserRole[]>> {
  const map = new Map<string, UserRole[]>();
  if (ids.length === 0) return map;
  const rows = await db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles).where(inArray(userRoles.userId, ids));
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push(r.role as UserRole);
    map.set(r.userId, list);
  }
  return map;
}

async function insertRoles(db: AppDatabase, userId: string, roles: UserRole[]): Promise<void> {
  if (roles.length === 0) return;
  await db.insert(userRoles).values(roles.map((role) => ({ userId, role }))).onConflictDoNothing();
}

function toEntity(row: UserRow, roles: UserRole[]): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName || row.username,
    bio: row.bio ?? null,
    email: row.email,
    phone: row.phone,
    passwordHash: row.passwordHash,
    roles,
    // @deprecated wire compat - derived tertinggi, jangan simpan
    role: derivePrimaryRole(roles),
    isActive: row.isActive,
    canContribute: row.canContribute,
    contributeMutedUntil: row.contributeMutedUntil ?? null,
    emailVerified: row.emailVerified,
    avatarUrl: row.avatarUrl ?? null,
    avatarProvider: row.avatarProvider ?? null,
    avatarProviderFileId: row.avatarProviderFileId ?? null,
    avatarSha: row.avatarSha ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

// Instance db di-inject lewat constructor - test bisa pakai testDb (Section 10)
export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return null;
    const roles = await loadRolesByUserIds(this.db, [row.id]);
    return toEntity(row, roles.get(row.id) ?? []);
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!row) return null;
    const roles = await loadRolesByUserIds(this.db, [row.id]);
    return toEntity(row, roles.get(row.id) ?? []);
  }

  async findByUsername(username: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!row) return null;
    const roles = await loadRolesByUserIds(this.db, [row.id]);
    return toEntity(row, roles.get(row.id) ?? []);
  }

  async findByPhone(phone: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!row) return null;
    const roles = await loadRolesByUserIds(this.db, [row.id]);
    return toEntity(row, roles.get(row.id) ?? []);
  }

  async save(user: NewUser): Promise<User> {
    const { roles: newRoles, ...rest } = user;
    const [row] = await this.db
      .insert(users)
      .values({
        ...rest,
        displayName: user.displayName ?? user.username,
        bio: user.bio ?? null,
      })
      .returning();
    const roles = newRoles ?? ['contributor'];
    await insertRoles(this.db, row.id, roles);
    return toEntity(row, roles);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async list(filter: UserListFilter): Promise<{ items: User[]; nextCursor: string | null; hasMore: boolean }> {
    const q = filter.q?.trim();
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
        canContribute: users.canContribute,
        contributeMutedUntil: users.contributeMutedUntil,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        // Di-select juga untuk cursor comparison walau tidak di-return ke user (deletedAt
        // tidak pernah tampil, tapi where exclude deleted).
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          // Multi role: filter "punya role" via EXISTS junction.
          filter.role
            ? sql`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = ${users.id} AND ur.role = ${filter.role})`
            : undefined,
          filter.canContribute === undefined ? undefined : eq(users.canContribute, filter.canContribute),
          // User sistem anonim tidak masuk daftar akun yang dihentikan.
          filter.canContribute === false ? sql`${users.id} != ${ANONIM_USER_ID}` : undefined,
          q
            ? or(
                like(sql`lower(${users.username})`, `%${q.toLowerCase()}%`),
                like(sql`lower(${users.email})`, `%${q.toLowerCase()}%`),
              )
            : undefined,
          filter.cursor ? lt(sql`(${users.createdAt}, ${users.id})`, sql`(SELECT created_at, id FROM users WHERE id = ${filter.cursor})`) : undefined,
        ),
      )
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(filter.limit + 1);

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;
    const rolesMap = await loadRolesByUserIds(this.db, page.map((r) => r.id));

    return {
      items: page.map((r) => toEntity({ ...r, passwordHash: null } as UserRow, rolesMap.get(r.id) ?? [])),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async listActiveIdsByRoles(roles: UserRole[]): Promise<string[]> {
    if (roles.length === 0) return [];
    const rows = await this.db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.isActive, true),
          inArray(userRoles.role, roles),
        ),
      );
    return rows.map((r) => r.id);
  }

  async setCanContribute(id: string, canContribute: boolean): Promise<boolean> {
    if (id === ANONIM_USER_ID) return false;
    const [updated] = await this.db
      .update(users)
      .set({
        canContribute,
        // Izinkan lagi: bersihkan mute sementara supaya gate langsung terbuka.
        ...(canContribute ? { contributeMutedUntil: null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return !!updated;
  }

  async setContributeMutedUntil(id: string, mutedUntil: Date | null): Promise<boolean> {
    if (id === ANONIM_USER_ID) return false;
    const [updated] = await this.db
      .update(users)
      .set({ contributeMutedUntil: mutedUntil, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return !!updated;
  }

  async getContributeGate(id: string): Promise<{
    isActive: boolean;
    canContribute: boolean;
    contributeMutedUntil: Date | null;
  } | null> {
    const [row] = await this.db
      .select({
        isActive: users.isActive,
        canContribute: users.canContribute,
        contributeMutedUntil: users.contributeMutedUntil,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!row || row.deletedAt) return null;
    return {
      isActive: row.isActive,
      canContribute: row.canContribute,
      contributeMutedUntil: row.contributeMutedUntil ?? null,
    };
  }

  async setIsActive(id: string, isActive: boolean): Promise<boolean> {
    if (id === ANONIM_USER_ID) return false;
    const [updated] = await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return !!updated;
  }

  async setRoles(id: string, roles: UserRole[]): Promise<void> {
    const unique = [...new Set(roles)];
    if (unique.length === 0) {
      throw new NotFoundError('INVALID_ROLE', 'Minimal satu role');
    }
    const [updated] = await this.db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }

    await this.db.delete(userRoles).where(eq(userRoles.userId, id));
    await insertRoles(this.db, id, unique);
  }

  async updatePhone(id: string, phone: string): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }
  }

  async updateAvatar(
    id: string,
    data: {
      avatarUrl: string;
      avatarProvider: string;
      avatarProviderFileId: string;
      avatarSha: string;
    },
  ): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({
        avatarUrl: data.avatarUrl,
        avatarProvider: data.avatarProvider,
        avatarProviderFileId: data.avatarProviderFileId,
        avatarSha: data.avatarSha,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }
  }

  async clearAvatar(id: string): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({
        avatarUrl: null,
        avatarProvider: null,
        avatarProviderFileId: null,
        avatarSha: null,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }
  }

  async updateProfile(
    id: string,
    data: { displayName?: string; bio?: string | null },
  ): Promise<User> {
    const [updated] = await this.db
      .update(users)
      .set({
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', `User ${id} tidak ditemukan`);
    }
    const roles = await loadRolesByUserIds(this.db, [updated.id]);
    return toEntity(updated, roles.get(updated.id) ?? []);
  }
}
