import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository, ExampleMedia } from '../../domain/repositories/word.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { hasFeedExcludedUsageLabels } from '@/shared/constants/usage-labels';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import type { Actor } from './create-word.use-case';

export interface UpdateExampleDto {
  sourceSentence: string;
  targetSentence?: string | null;
  sourceType?: string | null;
  notes?: string | null;
}

export type ExampleUpdateResult =
  | { outcome: 'updated'; media: ExampleMedia }
  | { outcome: 'no_changes' };

/**
 * #244: edit in-place kontribusi contoh pending milik sendiri.
 * Hanya baris status=pending_review && is_verified=false && created_by=actor.
 * Verifikator memakai jalur usulan change_example / correct - tidak lewat sini.
 */
export class UpdateExampleUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklist?: Pick<CommentBlocklistRepository, 'listAllActiveWords'>,
  ) {}

  /** Prefill form edit: contoh milik actor, apa pun statusnya. */
  async getMine(exampleId: string, actor: Actor): Promise<ExampleMedia> {
    const existing = await this.wordRepo.findExampleForOwner(exampleId, actor.userId);
    if (!existing) {
      throw new NotFoundError('EXAMPLE_NOT_FOUND', 'Contoh kalimat tidak ditemukan');
    }
    const { wordId: _wordId, ...media } = existing;
    return media;
  }

  /** #244: contoh pending milik actor untuk kata ini - overlay edit di detail lemma. */
  async listMineForWord(wordId: string, actor: Actor): Promise<ExampleMedia[]> {
    return this.wordRepo.findPendingExamplesForWord(wordId, actor.userId);
  }

  async execute(exampleId: string, dto: UpdateExampleDto, actor: Actor): Promise<ExampleUpdateResult> {
    const existing = await this.wordRepo.findExampleForOwner(exampleId, actor.userId);
    if (!existing) {
      throw new NotFoundError('EXAMPLE_NOT_FOUND', 'Contoh kalimat tidak ditemukan');
    }
    if (existing.status !== 'pending_review' || existing.isVerified) {
      throw new ConflictError(
        'EXAMPLE_ALREADY_REVIEWED',
        'Contoh yang sudah direview tidak bisa diedit. Kirim usulan perubahan lewat halaman kata.',
      );
    }

    dto = await this.censor(existing.wordId, dto);
    const source = dto.sourceSentence.trim();
    // undefined = pertahankan (tidak dikirim), null = kosongkan
    const nextTarget =
      dto.targetSentence === undefined ? existing.targetSentence : (dto.targetSentence ?? '').trim();
    if (source === existing.sourceSentence && (nextTarget ?? null) === (existing.targetSentence ?? null)) {
      return { outcome: 'no_changes' };
    }

    const media = await this.wordRepo.updateExampleContent(exampleId, actor.userId, {
      sourceSentence: source,
      targetSentence: nextTarget,
      sourceType: dto.sourceType,
      notes: dto.notes,
    });
    if (!media) {
      // Race: direview di antara find dan update - WHERE status masih pending.
      throw new ConflictError(
        'EXAMPLE_ALREADY_REVIEWED',
        'Contoh yang sudah direview tidak bisa diedit. Kirim usulan perubahan lewat halaman kata.',
      );
    }
    await this.auditRepo.record({
      userId: actor.userId,
      action: 'update',
      entityType: 'example',
      entityId: media.id,
      newData: {
        meaning_id: existing.meaningId,
        word_id: existing.wordId,
        source_sentence: media.sourceSentence,
        target_sentence: media.targetSentence,
        status: media.status,
        is_verified: media.isVerified,
      },
      requestId: actor.requestId ?? null,
    });
    return { outcome: 'updated', media };
  }

  /** Aturan sama dengan teks usulan: kata berlabel terlarang tidak disaring. */
  private async censor(wordId: string, dto: UpdateExampleDto): Promise<UpdateExampleDto> {
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
    const out: UpdateExampleDto = {
      ...dto,
      sourceSentence: censor(dto.sourceSentence, 'source_sentence'),
      targetSentence: dto.targetSentence ? censor(dto.targetSentence, 'target_sentence') : dto.targetSentence,
    };
    if (details.length > 0) throw new ValidationError(details);
    return out;
  }
}
