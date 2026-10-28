import type {
  PantunRhymeScheme,
  PantunStatus,
  PantunReplyStatus,
} from '@/shared/database/drizzle/schema/pantun.schema';

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
}

export interface NewPantunReply {
  parentId: string;
  userId: string;
  categoryId?: string | null;
  language: string;
  rhymeScheme: PantunRhymeScheme;
  lines: string[];
}

export interface PantunListFilter {
  limit: number;
  cursor?: string;
  categoryId?: string;
  /** Admin list: semua status. */
  status?: PantunStatus | 'all';
}
