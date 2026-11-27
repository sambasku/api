import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import { removeJinyeSourcedWordImages } from '../utils/remove-jinye-sourced-word-images';

export class TakedownJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly words?: Partial<
      Pick<WordRepository, 'softDeleteWordImagesFromJinye'>
    >,
    private readonly publicImageStorage?: PublicImageStoragePort,
  ) {}

  async execute(cmd: {
    id: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<Jinye> {
    const row = await this.repo.takedown(cmd.id, cmd.actorId);
    if (!row) {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    await removeJinyeSourcedWordImages(
      { words: this.words, storage: this.publicImageStorage },
      cmd.id,
      { onlyUnverified: false },
    );
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'takedown',
      entityType: 'jinye',
      entityId: cmd.id,
      oldData: { status: 'published' },
      newData: { status: 'taken_down' },
      requestId: cmd.requestId ?? null,
    });
    return row;
  }
}
