import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { Jinye, JinyeListFilter, NewJinye } from '../entities/jinye.entity';

export interface JinyeRepository {
  create(input: NewJinye): Promise<Jinye>;
  findById(id: string): Promise<Jinye | null>;
  list(filter: JinyeListFilter): Promise<CursorPage<Jinye>>;
  /** Create terbaru user mana pun statusnya (untuk kuota 24 jam). */
  findLatestCreatedAtByUser(userId: string): Promise<Date | null>;
  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
}
