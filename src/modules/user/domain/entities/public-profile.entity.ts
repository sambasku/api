export interface PublicProfileStats {
  contributionsApproved: number;
  /** Usul kata disetujui (entity_type = 'word'). */
  wordsApproved: number;
  /** Perbaikan disetujui: semua entity_type selain 'word'. */
  correctionsApproved: number;
  verificationsDone: number;
  commentsPublished: number;
}

/** Leveling derived (docs/LEVELING_AND_STREAK_IMPLEMENT.md). */
export interface PublicProfileLeveling {
  points: number;
  level: number;
  nextLevelPoints: number | null;
  titleCode: string;
  exploration: number;
  accuracy: number;
  depth: number;
  streakDays: number;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  bio: string | null;
  /** Self-declare: `native` | `learner` | null. */
  speakerStatus: 'native' | 'learner' | null;
  roles: string[];
  /** @deprecated Derived tertinggi dari roles (wire compat). */
  role: string;
  isVerifier: boolean;
  joinedAt: Date;
  avatarUrl: string | null;
  /** Bingkai profil aktif (reward `profile_border`); null = tanpa bingkai. */
  activeBorderUrl: string | null;
  /** Cara render border aktif: `image` | `lottie`. */
  activeBorderAssetKind: 'image' | 'lottie' | null;
  stats: PublicProfileStats;
  leveling: PublicProfileLeveling;
}

/** Baris aman untuk SELECT publik: tanpa email/phone/hash/is_active. */
export interface PublicUserRow {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  /** Self-declare: `native` | `learner` | null. */
  speakerStatus: 'native' | 'learner' | null;
  roles: string[];
  /** @deprecated Derived tertinggi dari roles (wire compat). */
  role: string;
  joinedAt: Date;
  avatarUrl: string | null;
  /** Bingkai profil aktif (reward `profile_border`); null = tanpa bingkai. */
  activeBorderUrl?: string | null;
  activeBorderAssetKind?: 'image' | 'lottie' | null;
}

/** Baris suggest mention (@username autocomplete). Kolom publik minimal. */
export interface MentionUserRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Filter query GET /users/:username/activity (selaras activity_events). */
export type PublicProfileActivityFilter =
  | 'contribution'
  | 'correction'
  | 'comment'
  | 'jinye';

export type PublicActivityKind =
  | PublicProfileActivityFilter
  | 'verification'
  | 'vote';

export interface PublicActivityItem {
  /** ULID sumber - dipakai sebagai cursor keyset (tidak dibocorkan ke response). */
  id: string;
  kind: PublicActivityKind;
  occurredAt: Date;
  wordId: string | null;
  lemma: string | null;
  summary: string;
}

/** Halaman aktivitas (mode cursor): items + meta keyset. */
export interface PublicActivityPage {
  items: PublicActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
