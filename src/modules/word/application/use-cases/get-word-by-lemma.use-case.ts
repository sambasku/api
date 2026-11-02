import { NotFoundError } from '@/shared/errors/app-error';
import type { WordDetail } from '../../domain/entities/word.entity';
import type { WordRepository } from '../../domain/repositories/word.repository';

/** Detail kata published berdasarkan lemma - pendukung URL publik /words/<lemma>. */
export class GetWordByLemmaUseCase {
  constructor(private readonly wordRepo: WordRepository) {}

  async execute(lemma: string): Promise<WordDetail> {
    // Resolusi lemma + detail dalam 2 round-trip Turso (dulu: 4 - id dulu,
    // baru detail). Homonim & guard published ditangani repository.
    const detail = await this.wordRepo.findPublishedDetailByLemma(lemma);
    if (!detail) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan lemma tersebut tidak ditemukan');
    }
    return detail;
  }
}
