import type { KaryaRepositoryImpl } from '@/modules/karya/infrastructure/karya.repository.impl';
import { NotFoundError } from '@/shared/errors/app-error';
import type { WordDetail } from '../../domain/entities/word.entity';
import type { WordRepository } from '../../domain/repositories/word.repository';
import {
  filterMeaningsForPublicDetail,
  isVerifierRole,
  publicReadGate,
} from '../utils/resolve-publication';

export class GetWordByIdUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly karyaRepo?: Pick<KaryaRepositoryImpl, 'listLemmaAppearancesByWordId'>,
  ) {}

  async execute(
    id: string,
    opts?: {
      includeAllStatuses?: boolean;
      viewerRoles?: string[];
      /** Periksa Kata / deep-link fokus: ikutkan makna ini meski belum verified. */
      focusMeaningId?: string;
      /** Tampilkan semua makna published (termasuk menunggu). */
      includeUnverified?: boolean;
    },
  ): Promise<WordDetail> {
    // includeAllStatuses (05-api-edit-kata.md): prefill form edit admin -
    // draft/pending_review/rejected juga terbaca.
    // Soft auth roles: verifikator boleh published + pending_review.
    // Default publik: repository status published; makna menunggu disaring
    // kecuali focus / includeUnverified / verifikator.
    const gate = opts?.includeAllStatuses
      ? undefined
      : publicReadGate(opts?.viewerRoles);
    const detail = await this.wordRepo.findDetailById(id, {
      includeAllStatuses: opts?.includeAllStatuses,
      statuses: gate?.statuses,
    });
    if (!detail) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata dengan id tersebut tidak ditemukan');
    }
    if (!opts?.includeAllStatuses) {
      detail.meanings = filterMeaningsForPublicDetail(detail.meanings ?? [], {
        viewerIsVerifier: Boolean(opts?.viewerRoles && isVerifierRole(opts.viewerRoles)),
        includeUnverified: opts?.includeUnverified === true,
        focusMeaningId: opts?.focusMeaningId,
      });
    }
    detail.appearsInKarya = this.karyaRepo
      ? await this.karyaRepo.listLemmaAppearancesByWordId(detail.id)
      : [];
    return detail;
  }
}
