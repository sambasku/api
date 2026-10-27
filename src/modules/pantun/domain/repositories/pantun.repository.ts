import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  NewPantun,
  NewPantunReply,
  Pantun,
  PantunListFilter,
  PantunReply,
} from '../entities/pantun.entity';

/** Hasil pencarian: pantun pembuka atau balasan (balasan bawa parentId). */
export type PantunSearchHit =
  | { kind: 'pantun'; pantun: Pantun }
  | { kind: 'reply'; reply: PantunReply };

export interface PantunRepository {
  create(input: NewPantun): Promise<Pantun>;
  findById(id: string): Promise<Pantun | null>;
  list(filter: PantunListFilter): Promise<CursorPage<Pantun>>;
  /** Cari isi 4 baris pantun published (induk + balasan), urut skor FTS. */
  searchPublished(q: string, limit: number): Promise<PantunSearchHit[]>;
  createReply(input: NewPantunReply): Promise<PantunReply>;
  findReplyById(id: string): Promise<PantunReply | null>;
  listReplies(parentId: string): Promise<PantunReply[]>;
  /** User unik yang pernah membalas pantun published (peserta thread). */
  listDistinctReplierUserIds(parentId: string): Promise<string[]>;
  markReplyDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  /** Hapus pantun sendiri (soft: status deleted_by_author). */
  markDeletedByAuthor(id: string, actorId: string): Promise<boolean>;
  takedownReply(id: string, actorId: string): Promise<boolean>;
  takedown(id: string, actorId: string): Promise<Pantun | null>;
}
