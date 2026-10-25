import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewPantun,
  NewPantunReply,
  Pantun,
  PantunListFilter,
  PantunReply,
} from '../entities/pantun.entity';

export interface PantunRepository {
  create(input: NewPantun): Promise<Pantun>;
  findById(id: string): Promise<Pantun | null>;
  list(filter: PantunListFilter): Promise<CursorPage<Pantun>>;
  createReply(input: NewPantunReply): Promise<PantunReply>;
  findReplyById(id: string): Promise<PantunReply | null>;
  listReplies(parentId: string): Promise<PantunReply[]>;
  markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownReply(id: string, actorId: string): Promise<boolean>;
  takedown(id: string, actorId: string): Promise<Pantun | null>;
}
