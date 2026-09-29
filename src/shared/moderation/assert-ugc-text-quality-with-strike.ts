import { BadRequestError } from '@/shared/errors/app-error';
import {
  assertUgcTextQuality,
  assessUgcTextQuality,
  hashUgcBody,
  type UgcTextQualityOpts,
} from './assert-ugc-text-quality';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from './record-abuse-signal.use-case';

/**
 * Quality gate + strike `input_rejected` bila gagal.
 * Melempar UGC_INPUT_REJECTED setelah (best-effort) mencatat sinyal.
 */
export async function assertUgcTextQualityWithStrike(
  raw: string,
  opts: UgcTextQualityOpts & {
    userId: string;
    abuse?: RecordAbuseSignalUseCase;
    entityType?: string;
    requestId?: string | null;
  },
): Promise<string> {
  const result = assessUgcTextQuality(raw, opts);
  if (result.ok) return result.normalized;

  await safeRecordAbuseSignal(opts.abuse, {
    userId: opts.userId,
    signal: 'input_rejected',
    entityType: opts.entityType,
    meta: {
      reason: result.reason,
      body_hash: hashUgcBody(raw.trim()),
      field: opts.field ?? 'body',
    },
    requestId: opts.requestId,
  });

  throw new BadRequestError('UGC_INPUT_REJECTED', result.reason, [
    { field: opts.field ?? 'body', message: result.reason },
  ]);
}

export { assertUgcTextQuality, hashUgcBody };
