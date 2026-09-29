import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  ClaimWordImportSessionInput,
  NewWordImportSession,
  WordImportSession,
} from '../entities/word-import-session.entity';

export interface WordImportSessionRepository {
  upsert(session: NewWordImportSession): Promise<WordImportSession>;
  findById(id: string): Promise<WordImportSession | null>;
  list(filter: { limit: number; cursor?: string; q?: string }): Promise<CursorPage<WordImportSession>>;
  /** Klaim batch: update sesi + geser created_by kata/makna/contoh terkait. */
  claim(input: ClaimWordImportSessionInput): Promise<WordImportSession>;
  /** Tandai sesi sudah di-rollback (idempotent bila sudah ada rolled_back_at). */
  markRolledBack(sessionId: string, actorId: string): Promise<WordImportSession>;
}
