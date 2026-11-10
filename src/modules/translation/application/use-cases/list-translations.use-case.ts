import {
  TRANSLATION_REFFS,
  type TranslationReff,
} from '@/shared/database/drizzle/schema';
import { BadRequestError } from '@/shared/errors/app-error';
import type {
  Translation,
  TranslationStatus,
} from '../../domain/entities/translation.entity';
import type { TranslationRepository } from '../../domain/repositories/translation.repository';

function isAllowedReff(reff: string): reff is TranslationReff {
  return (TRANSLATION_REFFS as readonly string[]).includes(reff);
}

export class ListTranslationsUseCase {
  constructor(private readonly translationRepo: TranslationRepository) {}

  async execute(input: {
    reff: string;
    reffId: string;
    status?: TranslationStatus;
  }): Promise<Translation[]> {
    if (!isAllowedReff(input.reff)) {
      throw new BadRequestError(
        'TRANSLATION_REFF_UNSUPPORTED',
        'reff tidak didukung',
      );
    }
    return this.translationRepo.list({
      reff: input.reff,
      reffId: input.reffId,
      status: input.status,
    });
  }
}
