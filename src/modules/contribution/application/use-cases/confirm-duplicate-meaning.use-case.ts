import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ToggleVoteUseCase } from '@/modules/vote/application/use-cases/toggle-vote.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';

export interface ConfirmDuplicateMeaningDto {
  wordId: string;
  meaningId: string;
  value: 1 | -1;
  userId: string;
  requestId?: string | null;
  clientId?: string | null;
}

export interface ConfirmDuplicateMeaningResult {
  wordId: string;
  meaningId: string;
  lemma: string;
  myVote: 1 | -1 | null;
  upvotes: number;
  downvotes: number;
  message: string;
}

/**
 * Konfirmasi duplikat: cast vote pada makna published + audit_logs
 * `duplicate_vote` agar muncul di riwayat perubahan kata.
 */
export class ConfirmDuplicateMeaningUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly toggleVote: ToggleVoteUseCase,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(dto: ConfirmDuplicateMeaningDto): Promise<ConfirmDuplicateMeaningResult> {
    const meaning = await this.wordRepo.findPublishedMeaningForDuplicateConfirm(
      dto.wordId,
      dto.meaningId,
    );
    if (!meaning) {
      throw new NotFoundError(
        'MEANING_NOT_FOUND',
        'Makna tidak ditemukan, belum tayang, atau tidak milik kata tersebut',
      );
    }

    if (dto.value !== 1 && dto.value !== -1) {
      throw new ValidationError([{ field: 'value', message: 'Pilih upvote (1) atau downvote (-1)' }]);
    }

    const vote = await this.toggleVote.execute({
      userId: dto.userId,
      targetType: 'meaning',
      targetId: dto.meaningId,
      value: dto.value,
      clientId: dto.clientId,
    });

    await this.auditRepo.record({
      userId: dto.userId,
      action: 'duplicate_vote',
      entityType: 'word',
      entityId: dto.wordId,
      newData: {
        meaning_id: meaning.meaningId,
        definition: meaning.definition,
        translation_text: meaning.translationText,
        value: dto.value,
        my_vote: vote.myVote,
      },
      requestId: dto.requestId ?? null,
    });

    const arah = dto.value === 1 ? 'dukungan' : 'penolakan';
    const message =
      vote.myVote === null
        ? `Vote dibatalkan. Jejak ${arah} tetap tercatat di riwayat perubahan ${meaning.lemma}.`
        : `Terima kasih. Kamu tercatat di riwayat perubahan ${meaning.lemma}.`;

    return {
      wordId: dto.wordId,
      meaningId: dto.meaningId,
      lemma: meaning.lemma,
      myVote: vote.myVote,
      upvotes: vote.upvotes,
      downvotes: vote.downvotes,
      message,
    };
  }
}
