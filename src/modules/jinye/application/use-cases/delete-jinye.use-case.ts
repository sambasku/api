import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { TranslationRepository } from '@/modules/translation/domain/repositories/translation.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { removeJinyeSourcedWordImages } from '../utils/remove-jinye-sourced-word-images';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class DeleteJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly words?: Pick<
      WordRepository,
      'cancelPendingExamplesFromJinye'
    > &
      Partial<Pick<WordRepository, 'softDeleteWordImagesFromJinye'>>,
    private readonly translations?: Pick<
      TranslationRepository,
      'rejectPending'
    >,
    private readonly publicImageStorage?: PublicImageStoragePort,
  ) {}

  async execute(input: {
    id: string;
    userId: string;
    requestId?: string | null;
  }): Promise<void> {
    const row = await this.repo.findById(input.id);
    if (!row || row.userId !== input.userId) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    const ok = await this.repo.markDeletedByAuthor(input.id, input.userId);
    if (!ok) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    await this.words?.cancelPendingExamplesFromJinye(input.id);
    await removeJinyeSourcedWordImages(
      { words: this.words, storage: this.publicImageStorage },
      input.id,
      { onlyUnverified: true },
    );
    await this.translations?.rejectPending('jinye', input.id);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'jinye',
      entityId: input.id,
      oldData: { status: row.status },
      newData: { status: 'deleted_by_author' },
      requestId: input.requestId ?? null,
    });
  }
}
