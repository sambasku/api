export interface PublicProfileStats {
  contributionsApproved: number;
  verificationsDone: number;
  commentsPublished: number;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  bio: string | null;
  role: string;
  isVerifier: boolean;
  joinedAt: Date;
  avatarUrl: string | null;
  stats: PublicProfileStats;
}

/** Baris aman untuk SELECT publik: tanpa email/phone/hash/is_active. */
export interface PublicUserRow {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  role: string;
  joinedAt: Date;
  avatarUrl: string | null;
}

/** Baris suggest mention (@username autocomplete). Kolom publik minimal. */
export interface MentionUserRow {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export type PublicActivityKind =
  | 'contribution'
  | 'comment'
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
