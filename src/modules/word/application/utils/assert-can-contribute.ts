import { ForbiddenError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';

export interface ContributeGateSnapshot {
  isActive: boolean;
  canContribute: boolean;
  contributeMutedUntil: Date | null;
}

/** null = user tidak ketemu (izinkan, supaya tes unit tidak butuh database). */
type ContributeGateLookup = (userId: string) => Promise<ContributeGateSnapshot | null>;

let lookup: ContributeGateLookup = async () => null;

/** Dipanggil sekali dari app.ts. Tanpa ini, pengecekan hak menulis tidak aktif. */
export function bindCanContributeLookup(fn: ContributeGateLookup): void {
  lookup = fn;
}

/**
 * Gerbang tulis UGC: akun aktif + tidak di-mute sementara + can_contribute.
 * Skip anonim (jalur tamu tetap rate/quality terpisah).
 */
export async function assertCanContribute(userId: string): Promise<void> {
  if (userId === ANONIM_USER_ID) return;
  const gate = await lookup(userId);
  if (!gate) return;

  if (!gate.isActive) {
    throw new ForbiddenError(
      'ACCOUNT_INACTIVE',
      'Akun ini tidak aktif. Hubungi tim Sambasku jika ini kekeliruan.',
    );
  }

  const mutedUntil = gate.contributeMutedUntil;
  if (mutedUntil && mutedUntil.getTime() > Date.now()) {
    throw new ForbiddenError(
      'CONTRIBUTION_MUTED',
      'Akun ini sementara tidak bisa mengirim konten. Coba lagi nanti.',
      [{ field: 'muted_until', message: mutedUntil.toISOString() }],
    );
  }

  if (gate.canContribute === false) {
    throw new ForbiddenError(
      'CONTRIBUTION_NOT_ALLOWED',
      'Akun ini tidak bisa mengirim usulan saat ini.',
    );
  }
}
