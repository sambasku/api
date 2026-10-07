import { NotFoundError } from '@/shared/errors/app-error';
import type { SearchMissRepository } from '../../domain/repositories/search-miss.repository';
import type { UserSkipRepository } from '@/modules/user-skip/infrastructure/user-skip.repository';

export interface SkipSearchMissCommand {
  missId: string;
  userId: string;
}

// Verifikator melewatkan (pass) satu miss di panel kartu (#88): miss tidak
// muncul lagi di panel user ini, tapi tetap terlihat verifikator lain.
// Sama seperti skip kontribusi - bukan keputusan moderasi, jadi status miss
// tidak berubah dan tidak ada audit log.
export class SkipSearchMissUseCase {
  constructor(
    private readonly searchMissRepo: SearchMissRepository,
    private readonly userSkipRepo: UserSkipRepository,
  ) {}

  async execute(cmd: SkipSearchMissCommand): Promise<void> {
    const miss = await this.searchMissRepo.findById(cmd.missId);
    if (!miss) {
      throw new NotFoundError('SEARCH_MISS_NOT_FOUND', 'Pencarian kosong dengan id tersebut tidak ditemukan');
    }
    await this.userSkipRepo.record(cmd.userId, 'search_miss', cmd.missId);
  }
}
