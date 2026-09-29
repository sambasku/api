export type DiscussionStatus =
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'taken_down';

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
  body: string | null;
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
  createdAt: Date;
  updatedAt: Date | null;
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
}

export interface NewDiscussionReply {
  discussionId: string;
  userId: string;
  body: string;
  bodyOriginal?: string | null;
  audio?: DiscussionReplyAudio | null;
}

export interface DiscussionListFilter {
  status?: DiscussionStatus;
  userId?: string;
  limit: number;
  cursor?: string;
  /** latest = id desc; popular = upvotes desc lalu id desc (hanya published). */
  sort?: 'latest' | 'popular';
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
