import { NotFoundError } from '@/shared/errors/app-error';
import type { WordDetail } from '../../domain/entities/word.entity';
import type { WordRepository } from '../../domain/repositories/word.repository';
import { publicReadGate } from '../utils/resolve-publication';

export class GetWordByIdUseCase {
  constructor(private readonly wordRepo: WordRepository) {}

  async execute(
    id: string,
    opts?: { includeAllStatuses?: boolean; viewerRoles?: string[] },
  ): Promise<WordDetail> {
    // includeAllStatuses (05-api-edit-kata.md): prefill form edit admin -
    // draft/pending_review/rejected juga terbaca.
    // Soft auth roles: verifikator boleh published + pending_review.
    // Default publik: repository hanya published + is_verified.
    const gate = opts?.includeAllStatuses
      ? undefined
      : publicReadGate(opts?.viewerRoles);
    const detail = await this.wordRepo.findDetailById(id, {
      includeAllStatuses: opts?.includeAllStatuses,
      statuses: gate?.statuses,
    });
    if (!detail) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    return detail;
  }
}
