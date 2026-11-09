import { NotFoundError } from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class GetJinyeDetailUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(input: {
    id: string;
    viewerId?: string | null;
    viewerIsAdmin?: boolean;
  }): Promise<Jinye & { isPinned: boolean }> {
    const row = await this.repo.findById(input.id);
    if (!row) throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');

    if (row.status !== 'published') {
      const isOwner = input.viewerId != null && input.viewerId === row.userId;
      if (!isOwner && !input.viewerIsAdmin) {
        throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
      }
    }

    const pinnedId = await this.repo.getPinnedJinyeId(row.userId);
    return { ...row, isPinned: pinnedId === row.id };
  }
}
