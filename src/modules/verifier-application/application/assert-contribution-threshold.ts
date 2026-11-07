import { ForbiddenError } from '@/shared/errors/app-error';
import { MIN_APPROVED_CONTRIBUTIONS } from '../domain/entities/verifier-application.entity';
import type { VerifierApplicationRepository } from '../domain/repositories/verifier-application.repository';

export async function assertEnoughContributions(
  appRepo: VerifierApplicationRepository,
  userId: string,
): Promise<void> {
  const approved = await appRepo.countApprovedContributions(userId);
  if (approved >= MIN_APPROVED_CONTRIBUTIONS) return;
  throw new ForbiddenError(
    'VERIFIER_CONTRIBUTIONS_TOO_FEW',
    `Kamu perlu minimal ${MIN_APPROVED_CONTRIBUTIONS} kontribusi yang sudah disetujui sebelum mengajukan.`,
  );
}
