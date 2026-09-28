import { ConflictError } from '@/shared/errors/app-error';
import type { PublishedDuplicateMeaning } from '../../domain/repositories/word.repository';

/** Lempar 409 DUPLICATE_MEANING dengan payload untuk modal vote klien. */
export function throwDuplicateMeaningConflict(match: PublishedDuplicateMeaning): never {
  throw new ConflictError(
    'DUPLICATE_MEANING',
    'Kata dan makna ini sudah ada di kamus. Pilih dukunganmu agar tercatat di riwayat perubahan.',
    {
      word_id: match.wordId,
      meaning_id: match.meaningId,
      lemma: match.lemma,
      definition: match.definition,
      translation_text: match.translationText,
    },
  );
}
