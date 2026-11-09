import type {
  PantunRhymeScheme,
  PantunStatus,
  PantunReplyStatus,
} from '@/shared/database/drizzle/schema/pantun.schema';

/** Metadata audio bacaan pantun (mirror DiscussionReplyAudio). */
export interface PantunAudio {
  url: string;
  mimeType: string;
  fileSize: number;
  durationMs: number | null;
  provider: string;
  providerFileId: string;
  sha: string | null;
}

export interface Pantun {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  categoryId: string | null;
  language: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
  audio: PantunAudio | null;
  status: PantunStatus;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PantunReply {
  id: string;
  parentId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userRole: string | null;
  categoryId: string | null;
  language: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
  audio: PantunAudio | null;
  status: PantunReplyStatus;
  /** EXISTS baris di pantun_reply_revisions (bukan sekadar updated_at). */
  isEdited?: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PantunReplyRevision {
  id: string;
  replyId: string;
  editorId: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
  createdAt: Date;
}

export interface NewPantun {
  userId: string;
  categoryId?: string | null;
  language: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
  audio?: PantunAudio | null;
  /** Opsional: pakai id yang sudah digenerate (path audio). */
  id?: string;
}

export interface NewPantunReply {
  parentId: string;
  userId: string;
  categoryId?: string | null;
  language: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
  audio?: PantunAudio | null;
  id?: string;
}

export interface PantunListFilter {
  limit: number;
  cursor?: string;
  categoryId?: string;
  /** Admin list: semua status. */
  status?: PantunStatus | 'all';
}
