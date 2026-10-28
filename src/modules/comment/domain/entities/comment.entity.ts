// Komentar pada lemma (09-api-comment.md). username/displayName di-resolve
// via LEFT JOIN users saat baca - null kalau penulis terhapus.
export type CommentStatus = 'published' | 'taken_down' | 'deleted_by_author';

export interface CommentAudio {
  url: string;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  provider: string;
  providerFileId: string;
  sha: string | null;
}

export interface Comment {
  id: string;
  wordId: string;
  /** Lemma kata (JOIN words) - null kalau kata sudah hilang */
  wordLemma: string | null;
  userId: string;
  username: string | null;
  /** Nama tampilan publik; fallback username. Null jika penulis hilang. */
  displayName: string | null;
  /** Avatar publik; null jika penulis hilang / tanpa foto. */
  avatarUrl: string | null;
  /** Role penulis (untuk is_verifier di wire); null jika penulis hilang. */
  userRole: string | null;
  /** Body tayang (terfilter blocklist jika ada); string kosong untuk voice-only */
  body: string;
  /** Teks asli sebelum sensor; null jika tidak disensor / sudah di-uncensor */
  bodyOriginal: string | null;
  audio: CommentAudio | null;
  status: CommentStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  /** true jika pernah disunting (EXISTS di comment_revisions). */
  isEdited?: boolean;
}

export interface CommentRevision {
  id: string;
  commentId: string;
  editorId: string;
  body: string;
  createdAt: Date;
}

/** Riwayat sunting (domain); wire di use case GET edit-history. */
export interface CommentEditHistory {
  current: {
    body: string | null;
    updatedAt: Date | null;
    isEdited: boolean;
  };
  revisions: CommentRevision[];
}

export interface NewComment {
  wordId: string;
  userId: string;
  body: string;
  bodyOriginal?: string | null;
  audio?: CommentAudio | null;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
