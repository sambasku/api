import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { KreatorLink } from '../domain/kreator';
import type { KreatorRepositoryImpl } from '../infrastructure/kreator.repository.impl';

export class KreatorUseCases {
  constructor(
    private readonly repo: KreatorRepositoryImpl,
    private readonly activity: RecordActivityEventUseCase,
  ) {}

  listPublic(input: { q?: string }) {
    return this.repo.listKreators(input);
  }

  async getBySlug(slug: string) {
    const kreator = await this.repo.findKreatorBySlug(slug);
    if (!kreator) {
      throw new NotFoundError('KREATOR_NOT_FOUND', 'Profil kreator tidak ditemukan');
    }
    const karyas = await this.repo.listPublishedKaryaByKreatorId(kreator.id);
    return { kreator, karyas };
  }

  async adminCreate(body: {
    displayName: string;
    kind?: 'person' | 'group';
    bio?: string | null;
    originRegion?: string | null;
    links?: KreatorLink[];
  }) {
    return this.repo.createKreator(body);
  }

  async adminUpdate(
    id: string,
    body: Partial<{
      displayName: string;
      kind: 'person' | 'group';
      bio: string | null;
      originRegion: string | null;
      links: KreatorLink[];
    }>,
  ) {
    const row = await this.repo.findKreatorById(id);
    if (!row) {
      throw new NotFoundError('KREATOR_NOT_FOUND', 'Kreator tidak ditemukan');
    }
    return this.repo.updateKreator(id, body);
  }

  async linkCredit(
    creditId: string,
    input: { kreatorId?: string; displayName?: string },
  ): Promise<void> {
    if (!input.kreatorId && !input.displayName?.trim()) {
      throw new BadRequestError('LINK_INVALID', 'Isi kreator_id atau display_name');
    }
    let kreatorId = input.kreatorId;
    if (!kreatorId) {
      const k = await this.repo.findOrCreateKreator(input.displayName!.trim());
      kreatorId = k.id;
    } else {
      const k = await this.repo.findKreatorById(kreatorId);
      if (!k) {
        throw new NotFoundError('KREATOR_NOT_FOUND', 'Kreator tidak ditemukan');
      }
    }
    await this.repo.linkCredit(creditId, kreatorId);
  }

  async submitClaim(userId: string, slug: string, proofNote: string) {
    if (!userId || userId === ANONIM_USER_ID) {
      throw new ForbiddenError('LOGIN_REQUIRED', 'Masuk dulu ya untuk mengajukan klaim');
    }
    const kreator = await this.repo.findKreatorBySlug(slug);
    if (!kreator) {
      throw new NotFoundError('KREATOR_NOT_FOUND', 'Profil kreator tidak ditemukan');
    }
    const approved = await this.repo.findApprovedClaimant(kreator.id);
    if (approved === userId) {
      throw new ConflictError('ALREADY_CLAIMED', 'Kamu sudah terverifikasi untuk profil ini');
    }
    const pending = await this.repo.findPendingClaim(kreator.id, userId);
    if (pending) {
      throw new ConflictError('CLAIM_PENDING', 'Klaim kamu masih menunggu tinjauan');
    }
    return this.repo.insertClaim({
      kreatorId: kreator.id,
      userId,
      proofNote,
    });
  }

  mineClaims(userId: string) {
    return this.repo.listClaimsByUser(userId);
  }

  listAdminClaims(status: 'pending' | 'approved' | 'rejected') {
    return this.repo.listClaimsByStatus(status);
  }

  async approveClaim(claimId: string, actorId: string) {
    const row = await this.repo.findClaimById(claimId);
    if (!row) {
      throw new NotFoundError('CLAIM_NOT_FOUND', 'Klaim tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Klaim sudah ditinjau');
    }
    const kreator = await this.repo.findKreatorById(row.kreatorId);
    if (!kreator) {
      throw new NotFoundError('KREATOR_NOT_FOUND', 'Kreator tidak ditemukan');
    }
    const existing = await this.repo.findApprovedClaimant(kreator.id);
    if (existing && existing !== row.userId) {
      throw new ConflictError(
        'CLAIM_CONFLICT',
        'Profil kreator ini sudah punya klaim yang disetujui',
      );
    }
    await this.repo.approveClaimExclusive(claimId);
    await this.activity.safe({
      kind: 'kreator_claimed',
      actorId: row.userId,
      targetId: kreator.id,
      payload: `Mengklaim profil kreator · "${kreator.displayName}"`,
      dedupeKey: `kreator_claimed:${kreator.id}:${row.userId}`,
    });
    void actorId;
  }

  async rejectClaim(claimId: string, reason?: string | null) {
    const row = await this.repo.findClaimById(claimId);
    if (!row) {
      throw new NotFoundError('CLAIM_NOT_FOUND', 'Klaim tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Klaim sudah ditinjau');
    }
    await this.repo.setClaimStatus(claimId, 'rejected', reason);
  }
}