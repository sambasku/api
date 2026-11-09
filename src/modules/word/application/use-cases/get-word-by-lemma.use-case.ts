import { NotFoundError } from '@/shared/errors/app-error';
import type { WordDetail } from '../../domain/entities/word.entity';
import type { WordRepository } from '../../domain/repositories/word.repository';
import { publicReadGate } from '../utils/resolve-publication';

/** Detail kata berdasarkan lemma - pendukung URL publik /words/<lemma>. */
export class GetWordByLemmaUseCase {
  constructor(private readonly wordRepo: WordRepository) {}

  async execute(lemma: string, opts?: { viewerRoles?: string[] }): Promise<WordDetail> {
    // Resolusi lemma + detail dalam 2 round-trip Turso. Homonim & gate
    // published/verified (atau statuses verifikator) ditangani repository.
    const gate = publicReadGate(opts?.viewerRoles);
    const detail = await this.wordRepo.findPublishedDetailByLemma(lemma, {
      statuses: gate.statuses,
    });
    if (!detail) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan lemma tersebut tidak ditemukan');
    }
    return detail;
  }
}
