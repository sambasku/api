import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type {
  NewWordImportSession,
  WordImportSession,
  WordImportSessionItem,
  WordImportSessionStatus,
  WordImportSupportType,
} from '../../domain/entities/word-import-session.entity';
import type { WordImportSessionRepository } from '../../domain/repositories/word-import-session.repository';
import type { UserLookupPort } from '../ports/user-lookup.port';
import { resolveImportAttributedTo } from '../utils/resolve-import-attribution';

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class SaveWordImportSessionUseCase {
  constructor(
    private readonly repo: WordImportSessionRepository,
    private readonly users: UserLookupPort,
  ) {}

  async execute(input: {
    id: string;
    triggeredBy: string;
    attributedTo?: string | null;
    sourceLabel?: string | null;
    supportName?: string | null;
    supportType?: WordImportSupportType | null;
    supportAddress?: string | null;
    supportTitle?: string | null;
    supportDesc?: string | null;
    status: WordImportSessionStatus;
    total: number;
    createdCount: number;
    duplicatesCount: number;
    meaningsAddedCount: number;
    invalidCount: number;
    items: WordImportSessionItem[];
  }): Promise<WordImportSession> {
    const attributedTo = await resolveImportAttributedTo(this.users, input.attributedTo);
    const payload: NewWordImportSession = {
      id: input.id,
      triggeredBy: input.triggeredBy,
      attributedTo,
      sourceLabel: emptyToNull(input.sourceLabel),
      supportName: emptyToNull(input.supportName),
      supportType: input.supportType ?? null,
      supportAddress: emptyToNull(input.supportAddress),
      supportTitle: emptyToNull(input.supportTitle),
      supportDesc: emptyToNull(input.supportDesc),
      status: input.status,
      total: input.total,
      createdCount: input.createdCount,
      duplicatesCount: input.duplicatesCount,
      meaningsAddedCount: input.meaningsAddedCount,
      invalidCount: input.invalidCount,
      items: input.items,
      // Sesi running belum selesai - finishedAt kosong sampai status final.
      finishedAt: input.status === 'running' ? null : new Date(),
    };
    return this.repo.upsert(payload);
  }
}

export class ListWordImportSessionsUseCase {
  constructor(private readonly repo: WordImportSessionRepository) {}

  async execute(input: { limit?: number; cursor?: string; q?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    return this.repo.list({ limit, cursor: input.cursor, q: input.q });
  }
}

export class GetWordImportSessionUseCase {
  constructor(private readonly repo: WordImportSessionRepository) {}

  async execute(id: string): Promise<WordImportSession> {
    const session = await this.repo.findById(id);
    if (!session) throw new NotFoundError('NOT_FOUND', 'Sesi impor tidak ditemukan');
    return session;
  }
}

export class ClaimWordImportSessionUseCase {
  constructor(
    private readonly repo: WordImportSessionRepository,
    private readonly users: UserLookupPort,
  ) {}

  async execute(input: {
    sessionId: string;
    attributedTo: string;
    claimedBy: string;
  }): Promise<WordImportSession> {
    const session = await this.repo.findById(input.sessionId);
    if (!session) throw new NotFoundError('NOT_FOUND', 'Sesi impor tidak ditemukan');

    if (session.attributedTo !== CSV_IMPORTER_USER_ID) {
      throw new ConflictError(
        'IMPORT_ALREADY_ATTRIBUTED',
        'Sesi ini sudah diatribusikan ke user. Klaim hanya untuk batch Pengimpor Data CSV.',
      );
    }

    const toUserId = await resolveImportAttributedTo(this.users, input.attributedTo);
    if (toUserId === CSV_IMPORTER_USER_ID) {
      throw new ConflictError(
        'IMPORT_CLAIM_INVALID',
        'Pilih user nyata untuk klaim, bukan Pengimpor Data CSV.',
      );
    }

    const createdLemmas = session.items
      .filter((item) => item.outcome === 'created')
      .map((item) => item.lemma);
    const meaningLemmas = session.items
      .filter((item) => item.outcome === 'meanings_added')
      .map((item) => item.lemma);

    return this.repo.claim({
      sessionId: session.id,
      fromUserId: session.attributedTo,
      toUserId,
      claimedBy: input.claimedBy,
      createdLemmas,
      meaningLemmas,
    });
  }
}
