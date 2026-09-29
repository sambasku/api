import { ForbiddenError } from '@/shared/errors/app-error';
import type {
  AnonAbuseSubject,
  AnonAbuseSignal,
  UgcAnonAbuseRepository,
} from './ugc-anon-abuse.repository';
import { ANON_ABUSE_WEIGHTS } from './ugc-anon-abuse.repository';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface AnonClientContext {
  clientIp: string;
  deviceId: string | null;
}

export interface RecordAnonAbuseSignalCommand {
  clientIp: string;
  deviceId?: string | null;
  signal: AnonAbuseSignal;
  weight?: number;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

function subjectsFrom(ctx: { clientIp: string; deviceId?: string | null }): AnonAbuseSubject[] {
  const out: AnonAbuseSubject[] = [];
  const ip = ctx.clientIp.trim();
  if (ip && ip !== 'unknown') {
    out.push({ kind: 'ip', key: ip });
  }
  const device = ctx.deviceId?.trim();
  if (device) {
    out.push({ kind: 'device', key: device });
  }
  return out;
}

/**
 * Tolak tulis anon bila IP atau device sedang di-mute.
 */
export async function assertAnonWriteAllowed(
  repo: UgcAnonAbuseRepository,
  ctx: AnonClientContext,
): Promise<void> {
  const now = Date.now();
  let latest: Date | null = null;
  for (const subject of subjectsFrom(ctx)) {
    const until = await repo.getMutedUntil(subject);
    if (until && until.getTime() > now) {
      if (!latest || until.getTime() > latest.getTime()) latest = until;
    }
  }
  if (latest) {
    throw new ForbiddenError(
      'ANON_CONTRIBUTION_MUTED',
      'Pengiriman dari perangkat atau jaringan ini sementara dibatasi. Coba lagi nanti.',
      [{ field: 'muted_until', message: latest.toISOString() }],
    );
  }
}

/**
 * Catat sinyal abuse per IP dan (jika ada) device, lalu evaluasi mute progresif.
 */
export class RecordAnonAbuseSignalUseCase {
  constructor(private readonly repo: UgcAnonAbuseRepository) {}

  async execute(cmd: RecordAnonAbuseSignalCommand): Promise<void> {
    const subjects = subjectsFrom(cmd);
    if (subjects.length === 0) return;

    const weight = cmd.weight ?? ANON_ABUSE_WEIGHTS[cmd.signal] ?? 0;
    for (const subject of subjects) {
      await this.repo.record({
        subject,
        signal: cmd.signal,
        weight,
        entityType: cmd.entityType,
        entityId: cmd.entityId,
        meta: cmd.meta,
      });
    }

    if (cmd.signal === 'policy_mute') return;

    for (const subject of subjects) {
      await this.evaluatePolicy(subject);
    }
  }

  private async evaluatePolicy(subject: AnonAbuseSubject): Promise<void> {
    const now = Date.now();
    const score24h = await this.repo.sumWeightSince(subject, new Date(now - DAY_MS));
    const score7d = await this.repo.sumWeightSince(subject, new Date(now - 7 * DAY_MS));
    const score30d = await this.repo.sumWeightSince(subject, new Date(now - 30 * DAY_MS));

    let until: Date | null = null;
    let window = '';
    if (score30d >= 10) {
      until = new Date(now + 7 * DAY_MS);
      window = '7d';
    } else if (score7d >= 6) {
      until = new Date(now + DAY_MS);
      window = '24h';
    } else if (score24h >= 3) {
      until = new Date(now + HOUR_MS);
      window = '1h';
    }
    if (!until) return;

    await this.repo.setMutedUntil(subject, until);
    await this.repo.record({
      subject,
      signal: 'policy_mute',
      weight: 0,
      meta: { muted_until: until.toISOString(), window },
    });
  }
}

export async function safeRecordAnonAbuseSignal(
  recorder: RecordAnonAbuseSignalUseCase | undefined,
  cmd: RecordAnonAbuseSignalCommand,
): Promise<void> {
  if (!recorder) return;
  try {
    await recorder.execute(cmd);
  } catch {
    // best-effort
  }
}
