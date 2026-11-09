import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Jinye,
  JinyeAudio,
  JinyeComment,
  JinyeListFilter,
  NewJinye,
  NewJinyeComment,
} from '../entities/jinye.entity';

export interface JinyeRepository {
  create(input: NewJinye): Promise<Jinye>;
  findById(id: string): Promise<Jinye | null>;
  list(filter: JinyeListFilter): Promise<CursorPage<Jinye>>;
  /** Create terbaru user mana pun statusnya (untuk kuota 24 jam). */
  findLatestCreatedAtByUser(userId: string): Promise<Date | null>;
  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  setAudio(input: { id: string; audio: JinyeAudio }): Promise<Jinye | null>;

  createComment(input: NewJinyeComment): Promise<JinyeComment>;
  findCommentById(id: string): Promise<JinyeComment | null>;
  /** Semua published comments untuk satu Jinye (top-level + replies). */
  listCommentsByJinyeId(jinyeId: string): Promise<JinyeComment[]>;
  markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  incrementPublishedCommentCount(jinyeId: string, delta: number): Promise<void>;
}
