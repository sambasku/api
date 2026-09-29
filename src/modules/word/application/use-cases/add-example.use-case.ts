import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository, ExampleMedia } from '../../domain/repositories/word.repository';
import { resolveChildPublication } from '../utils/resolve-publication';
import { assertCanContribute } from '../utils/assert-can-contribute';
import type { Actor } from './create-word.use-case';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { hasFeedExcludedUsageLabels } from '@/shared/constants/usage-labels';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';

export interface AddExampleDto {
  sourceLanguageId: string;
  sourceSentence: string;
  targetLanguageId?: string | null;
  targetSentence?: string | null;
  sourceType?: string | null;
  notes?: string | null;
}

// Kontribusi contoh kalimat (sample) pada makna existing
// (03-api-kontribusi-verifikasi.md). Contributor → pending_review.
export class AddExampleUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'listAllActiveWords'>,
  ) {}

  async execute(meaningId: string, dto: AddExampleDto, actor: Actor): Promise<ExampleMedia> {
    await assertCanContribute(actor.userId);
    const meaning = await this.wordRepo.findMeaningById(meaningId);
    if (!meaning) {
      throw new NotFoundError('MEANING_NOT_FOUND', 'Makna dengan id tersebut tidak ditemukan');
    }
    dto = await this.censor(meaning.wordId, dto);

    // Bahasa sumber/target harus valid - FK violation di-repository jadi
    // 500 kalau tidak dicek di sini (pola findMissingReferences create-word)
    const missing = await this.wordRepo.findMissingReferences({
      languageId: dto.sourceLanguageId,
      wordClassIds: [],
      languageIds: dto.targetLanguageId ? [dto.targetLanguageId] : [],
      categoryIds: [],
      relatedWordIds: [],
      variantDialectIds: [],
      inline: { wordClassIds: [], languageIds: [], categoryIds: [], variantDialectIds: [] },
    });
    const details: { field: string; message: string }[] = [];
    if (missing.languageId) {
      details.push({ field: 'source_language_id', message: 'Bahasa tidak ditemukan' });
    }
    for (const id of missing.languages) {
      details.push({ field: 'target_language_id', message: `Bahasa tidak ditemukan (${id})` });
    }
    if (details.length > 0) throw new ValidationError(details);

    const publication = resolveChildPublication(actor.role);
    const media = await this.wordRepo.addExample(meaningId, { ...dto, ...publication }, actor.userId);

    await this.auditRepo.record({
      userId: actor.userId,
      action: 'create',
      entityType: 'example',
      entityId: media.id,
      newData: {
        meaning_id: meaningId,
        word_id: meaning.wordId,
        source_sentence: media.sourceSentence,
        status: media.status,
        is_verified: media.isVerified,
      },
      requestId: actor.requestId ?? null,
    });

    return media;
  }

  /** Aturan sama dengan teks usulan: kata berlabel terlarang tidak disaring. */
  private async censor(wordId: string, dto: AddExampleDto): Promise<AddExampleDto> {
    if (!this.blocklist) return dto;
    const word = await this.wordRepo.findById(wordId);
    if (hasFeedExcludedUsageLabels(word?.usageLabels)) return dto;
    const blocked = await this.blocklist.listAllActiveWords();
    if (blocked.length === 0) return dto;

    const details: { field: string; message: string }[] = [];
    const censor = (value: string, field: string) => {
      const filtered = applyBlocklistFilter(value, blocked);
      if (isHeavyCensor(value, filtered)) {
        details.push({ field, message: 'Teks mengandung kata yang tidak pantas' });
      }
      return filtered;
    };
    const out: AddExampleDto = {
      ...dto,
      sourceSentence: censor(dto.sourceSentence, 'source_sentence'),
      targetSentence: dto.targetSentence ? censor(dto.targetSentence, 'target_sentence') : dto.targetSentence,
    };
    if (details.length > 0) throw new ValidationError(details);
    return out;
  }
}
