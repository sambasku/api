import { BadRequestError } from '@/shared/errors/app-error';
import {
  assessUgcTextQuality,
  hashUgcBody,
  type UgcTextQualityOpts,
} from './assert-ugc-text-quality';
import {
  RecordAnonAbuseSignalUseCase,
  safeRecordAnonAbuseSignal,
} from './record-anon-abuse-signal.use-case';

/**
 * Quality gate untuk tamu: strike ke ledger IP/device, bukan ANONIM_USER_ID.
 */
export async function assertUgcTextQualityWithAnonStrike(
  raw: string,
  opts: UgcTextQualityOpts & {
    clientIp: string;
    deviceId?: string | null;
    abuse?: RecordAnonAbuseSignalUseCase;
    entityType?: string;
  },
): Promise<string> {
  const result = assessUgcTextQuality(raw, opts);
  if (result.ok) return result.normalized;

  await safeRecordAnonAbuseSignal(opts.abuse, {
    clientIp: opts.clientIp,
    deviceId: opts.deviceId,
    signal: 'input_rejected',
    entityType: opts.entityType,
    meta: {
      reason: result.reason,
      body_hash: hashUgcBody(raw.trim()),
      field: opts.field ?? 'body',
    },
  });

  throw new BadRequestError('UGC_INPUT_REJECTED', result.reason, [
    { field: opts.field ?? 'body', message: result.reason },
  ]);
}
