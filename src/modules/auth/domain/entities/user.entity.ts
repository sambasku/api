export type UserRole = 'root' | 'admin' | 'reviewer' | 'editor' | 'contributor';

/** Urutan kepentingan role (root tertinggi) - untuk derived field `role` deprecated di wire. */
export const ROLE_RANK: Record<UserRole, number> = {
  root: 5,
  admin: 4,
  reviewer: 3,
  editor: 2,
  contributor: 1,
};

/**
 * Role tertinggi dari array roles. Satu-satunya sumber nilai claim/field
 * `role` yang deprecated di wire - jangan duplikasi logika ini di tempat lain.
 * Array kosong fallback `contributor` (role paling rendah, paling terbatas).
 */
export function derivePrimaryRole(roles: UserRole[] | readonly string[]): UserRole {
  let best: UserRole = 'contributor';
  for (const r of roles) {
    if (r in ROLE_RANK && ROLE_RANK[r as UserRole] > ROLE_RANK[best]) best = r as UserRole;
  }
  return best;
}

// Entitas domain - murni TypeScript, tidak tahu Drizzle/HTTP
export interface User {
  id: string; // ULID
  username: string;
  /** Nama tampilan publik; awalnya = username, boleh diedit tanpa ganti username. */
  displayName: string;
  /** Bio publik opsional. */
  bio: string | null;
  email: string;
  // Digit internasional tanpa '+', mis. 62899… / 6012… - null bila user skip saat register
  phone: string | null;
  // NULL untuk user OAuth-only (Section 23) - login password wajib menolaknya
  passwordHash: string | null;
  /** Semua role user (multi role, junction user_roles). Minimal satu. */
  roles: UserRole[];
  /** @deprecated Derived tertinggi dari roles (wire compat). Baca `roles`. */
  role: UserRole;
  isActive: boolean;
  canContribute: boolean;
  /** Mute sementara; null = tidak di-mute. */
  contributeMutedUntil: Date | null;
  emailVerified: boolean;
  /** Waktu tap "Mengerti" di guide swipe halaman kontribusi; null = belum. */
  readContributionGuideAt: Date | null;
  avatarUrl: string | null;
  avatarProvider: string | null;
  avatarProviderFileId: string | null;
  avatarSha: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null; // soft delete - tidak boleh bisa login lagi
}

export type NewUser = Pick<User, 'username' | 'email' | 'passwordHash' | 'phone'> & {
  emailVerified?: boolean;
  /** Default `['contributor']` bila diabaikan (registrasi publik). */
  roles?: UserRole[];
  /** Default DB aktif bila diabaikan. */
  isActive?: boolean;
  /** Default = username bila diabaikan saat save. */
  displayName?: string;
  bio?: string | null;
};

export interface UserListFilter {
  q?: string;
  /** Filter user yang PUNYA role ini (multi role: EXISTS junction). */
  role?: UserRole;
  canContribute?: boolean;
  limit: number;
  cursor?: string;
}

export interface UserListResult {
  items: User[];
  nextCursor: string | null;
  hasMore: boolean;
}
