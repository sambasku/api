import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export interface JinyeEditHistoryResult {
  current: {
    body: string;
    updated_at: string | null;
    is_edited: boolean;
  };
  revisions: Array<{
    body: string;
    editor_id: string;
    created_at: string;
  }>;
}

/** Riwayat sunting Jinye (publik, hanya published). */
export class GetJinyeEditHistoryUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(jinyeId: string): Promise<JinyeEditHistoryResult> {
    const row = await this.repo.findById(jinyeId);
    if (!row || row.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    const revisions = await this.repo.listRevisions(jinyeId);
    return {
      current: {
        body: row.body,
        updated_at: row.updatedAt?.toISOString() ?? null,
        is_edited: row.isEdited === true || revisions.length > 0,
      },
      revisions: revisions.map((r) => ({
        body: r.body,
        editor_id: r.editorId,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
