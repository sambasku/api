export type DiscussionStatus =
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'taken_down'
  | 'deleted_by_author';

export type DiscussionReplyStatus = 'published' | 'taken_down' | 'deleted_by_author';

export interface DiscussionImage {
  url: string;
  providerFileId: string;
  publicUrl: string | null;
  /** Peringatan visual (parity foto kata). Hanya diisi saat approve. */
  contentWarnings: string[];
}

export interface Discussion {
  id: string;
  userId: string;
  username: string | null;
  /** Nama tampilan publik; fallback username. */
  displayName: string | null;
  /** Avatar publik pembuka thread; null jika penulis hilang / tanpa foto. */
  avatarUrl: string | null;
  /** Role tertinggi penulis. Null jika akun hilang. Dipakai centang verifikator. */
  userRole: string | null;
  body: string | null;
  /** Teks sebelum filter blocklist (null = tidak tersensor). */
  bodyOriginal: string | null;
  /** Tautan https luar (opsional). */
  linkUrl: string | null;
  images: DiscussionImage[];
  /** Audio opening thread; null jika belum dilampirkan. */
  audio: DiscussionReplyAudio | null;
  status: DiscussionStatus;
  rejectionNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  pinnedReplyId: string | null;
  /** Denorm: waktu balasan published terakhir; null jika belum ada. */
  lastReplyAt: Date | null;
  /** Denorm: jumlah balasan published. */
  publishedReplyCount: number;
  createdAt: Date;
  updatedAt: Date | null;
  /** true jika pernah disunting (EXISTS di discussion_revisions). */
  isEdited?: boolean;
}

export interface DiscussionRevision {
  id: string;
  discussionId: string;
  editorId: string;
  body: string;
  createdAt: Date;
}

export interface NewDiscussion {
  userId: string;
  body: string;
  linkUrl?: string | null;
  images: DiscussionImage[];
}

export interface DiscussionReplyAudio {
  url: string;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  provider: string;
  providerFileId: string;
  sha: string | null;
}

export interface DiscussionReply {
  id: string;
  discussionId: string;
  userId: string;
  username: string | null;
  /** Nama tampilan publik; fallback username. */
  displayName: string | null;
  /** Avatar publik; null jika penulis hilang / tanpa foto. */
  avatarUrl: string | null;
  /** Role penulis - dipakai highlight verifikator di render, bukan flag DB. */
  userRole: string | null;
  /** Caption; string kosong untuk voice-only (wire → null). */
  body: string;
  bodyOriginal: string | null;
  audio: DiscussionReplyAudio | null;
  status: DiscussionReplyStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  /** true jika pernah disunting (EXISTS di discussion_reply_revisions). */
  isEdited?: boolean;
}

export interface DiscussionReplyRevision {
  id: string;
  replyId: string;
  editorId: string;
  body: string;
  createdAt: Date;
}

export interface NewDiscussionReply {
  discussionId: string;
  userId: string;
  body: string;
  bodyOriginal?: string | null;
  audio?: DiscussionReplyAudio | null;
}

/** Kunci sort feed publik (#204). Alias: latest→created, popular→votes. */
export type DiscussionListSort =
  | 'created'
  | 'activity'
  | 'votes'
  | 'replies'
  | 'latest'
  | 'popular';

export type DiscussionListOrder = 'asc' | 'desc';

export interface DiscussionListFilter {
  status?: DiscussionStatus;
  userId?: string;
  limit: number;
  cursor?: string;
  /**
   * created/latest = id; activity = last_reply COALESCE created;
   * votes/popular = upvote; replies = published_reply_count.
   */
  sort?: DiscussionListSort;
  /** Default desc. Diabaikan untuk alias latest/popular (selalu desc). */
  order?: DiscussionListOrder;
}

/** Normalisasi sort wire → kunci kanonik + arah. */
export function normalizeDiscussionListSort(
  sort: DiscussionListSort | undefined,
  order: DiscussionListOrder | undefined,
): { sort: 'created' | 'activity' | 'votes' | 'replies'; order: DiscussionListOrder } {
  if (sort === 'latest' || sort == null) {
    return { sort: 'created', order: 'desc' };
  }
  if (sort === 'popular') {
    return { sort: 'votes', order: 'desc' };
  }
  return { sort, order: order === 'asc' ? 'asc' : 'desc' };
}

export interface DiscussionReplyListFilter {
  discussionId: string;
  limit?: number;
}

/** Role yang ditandai badge Verifikator di thread balasan. */
export const VERIFIER_HIGHLIGHT_ROLES = new Set(['admin', 'editor', 'reviewer', 'root']);

export function isVerifierRole(role: string | null | undefined): boolean {
  return role != null && VERIFIER_HIGHLIGHT_ROLES.has(role);
}
