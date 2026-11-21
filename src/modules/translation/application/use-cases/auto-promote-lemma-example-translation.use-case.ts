import { LEMMA_EXAMPLE_TRANSLATION_REFF } from '@/shared/database/drizzle/schema';
import type { ExampleMedia } from '@/modules/word/domain/repositories/word.repository';
import type { TranslationRepository } from '../../domain/repositories/translation.repository';

/**
 * Auto-promote contoh lemma yang sudah punya terjemahan kalimat
 * (`target_sentence`) ke tabel `translations` (reff=`lemma_example`,
 * status accepted). Dipanggil saat:
 * - verifikator membuat contoh (langsung published), atau
 * - verifikator menyetujui kontribusi contoh.
 *
 * Tanpa `target_sentence` → no-op (belum ada teks ID untuk dipromosikan).
 */
export class AutoPromoteLemmaExampleTranslationUseCase {
  constructor(private readonly translationRepo: TranslationRepository) {}

  async execute(input: {
    example: Pick<ExampleMedia, 'id' | 'sourceSentence' | 'targetSentence' | 'status'>;
    actorId: string;
  }): Promise<void> {
    const target = input.example.targetSentence?.trim() ?? '';
    const source = input.example.sourceSentence.trim();
    if (!target || !source) return;
    if (input.example.status !== 'published') return;

    await this.translationRepo.upsertAccepted({
      reff: LEMMA_EXAMPLE_TRANSLATION_REFF,
      reffId: input.example.id,
      sourceBody: source,
      body: target,
      translatorId: input.actorId,
      reviewerId: input.actorId,
    });
  }

  /** Best-effort: gagal promote tidak menggagalkan approve/create contoh. */
  async safe(input: {
    example: Pick<ExampleMedia, 'id' | 'sourceSentence' | 'targetSentence' | 'status'>;
    actorId: string;
  }): Promise<void> {
    try {
      await this.execute(input);
    } catch (err) {
      console.error('[auto-promote-lemma-example]', err);
    }
  }
}
