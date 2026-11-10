import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Jinye,
  JinyeAudio,
  JinyeComment,
  JinyeLemmaLink,
  JinyeListFilter,
  JinyeRevision,
  JinyeTranslation,
  JinyeTranslationStatus,
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
  /**
   * Create yang makan kuota 24 jam: original + quote.
   * Repost polos (repost_of_id set, quote_body null) tidak dihitung.
   */
  findLatestQuotaConsumingCreatedAtByUser(
    userId: string,
  ): Promise<Date | null>;
  /** @deprecated pakai findLatestQuotaConsumingCreatedAtByUser */
  findLatestCreatedAtByUser(userId: string): Promise<Date | null>;
  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  /** Admin: published → taken_down. */
  takedown(id: string, actorId: string): Promise<Jinye | null>;
  updateBody(input: {
    id: string;
    editorId: string;
    body: string;
    bodyOriginal: string | null;
  }): Promise<Jinye | null>;
  listRevisions(jinyeId: string): Promise<JinyeRevision[]>;
  markLemmaLinksStale(jinyeId: string): Promise<number>;
  findPlainRepostByUser(
    originalId: string,
    userId: string,
  ): Promise<Jinye | null>;
  adjustRepostCount(jinyeId: string, delta: number): Promise<void>;
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
  /** Admin: published → taken_down. */
  takedownComment(id: string, actorId: string): Promise<boolean>;
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

  createTranslation(input: {
    jinyeId: string;
    bodyId: string;
    translatorId: string;
  }): Promise<JinyeTranslation>;
  findTranslationById(id: string): Promise<JinyeTranslation | null>;
  listTranslationsByJinyeId(jinyeId: string): Promise<JinyeTranslation[]>;
  findPendingTranslationByTranslator(
    jinyeId: string,
    translatorId: string,
  ): Promise<JinyeTranslation | null>;
  findAcceptedTranslation(jinyeId: string): Promise<JinyeTranslation | null>;
  updateTranslation(
    id: string,
    patch: {
      status?: JinyeTranslationStatus;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
    },
  ): Promise<JinyeTranslation | null>;
  /** Reject semua pending translation saat sumber hilang. */
  rejectPendingTranslations(jinyeId: string): Promise<number>;
}
