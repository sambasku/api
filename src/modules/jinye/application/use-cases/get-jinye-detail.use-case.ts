import { NotFoundError } from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

export class GetJinyeDetailUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(input: {
    id: string;
    viewerId?: string | null;
    viewerIsAdmin?: boolean;
  }): Promise<Jinye> {
    const row = await this.repo.findById(input.id);
    if (!row) throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');

    if (row.status === 'published') return row;

    const isOwner = input.viewerId != null && input.viewerId === row.userId;
    if (isOwner || input.viewerIsAdmin) return row;

    throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
  }
}
