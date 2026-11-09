import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Jinye,
  JinyeAudio,
  JinyeComment,
  JinyeLemmaLink,
  JinyeListFilter,
  NewJinye,
  NewJinyeComment,
} from '../entities/jinye.entity';
import type {
  JinyeLemmaLinkSource,
  JinyeLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/jinye-lemma-links.schema';

export interface JinyeRepository {
  create(input: NewJinye): Promise<Jinye>;
  findById(id: string): Promise<Jinye | null>;
  list(filter: JinyeListFilter): Promise<CursorPage<Jinye>>;
  /** Create terbaru user mana pun statusnya (untuk kuota 24 jam). */
  findLatestCreatedAtByUser(userId: string): Promise<Date | null>;
  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  setAudio(input: { id: string; audio: JinyeAudio }): Promise<Jinye | null>;
  /** published ↔ archived. Owner check di use case. */
  setStatus(input: {
    id: string;
    userId: string;
    from: 'published' | 'archived';
    to: 'published' | 'archived';
  }): Promise<Jinye | null>;
  getPinnedJinyeId(userId: string): Promise<string | null>;
  setPinnedJinyeId(userId: string, jinyeId: string | null): Promise<void>;
  /** Lepas pin bila users.pinned_jinye_id = jinyeId. */
  clearPinnedIf(jinyeId: string): Promise<void>;

  createComment(input: NewJinyeComment): Promise<JinyeComment>;
  findCommentById(id: string): Promise<JinyeComment | null>;
  /** Semua published comments untuk satu Jinye (top-level + replies). */
  listCommentsByJinyeId(jinyeId: string): Promise<JinyeComment[]>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  incrementPublishedCommentCount(jinyeId: string, delta: number): Promise<void>;

  createLemmaLink(input: {
    jinyeId?: string | null;
    commentId?: string | null;
    start: number;
    end: number;
    wordId: string;
    source: JinyeLemmaLinkSource;
    status?: JinyeLemmaLinkStatus;
  }): Promise<JinyeLemmaLink>;
  findLemmaLinkById(id: string): Promise<JinyeLemmaLink | null>;
  listLemmaLinksByJinyeId(jinyeId: string): Promise<JinyeLemmaLink[]>;
  listActiveLemmaLinksForTarget(input: {
    jinyeId?: string | null;
    commentId?: string | null;
  }): Promise<JinyeLemmaLink[]>;
  updateLemmaLink(
    id: string,
    patch: {
      wordId?: string;
      status?: JinyeLemmaLinkStatus;
      source?: JinyeLemmaLinkSource;
      proposedWordId?: string | null;
      proposedBy?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
    },
  ): Promise<JinyeLemmaLink | null>;
  deleteLemmaLink(id: string): Promise<boolean>;
}
