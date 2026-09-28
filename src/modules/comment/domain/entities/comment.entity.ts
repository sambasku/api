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
