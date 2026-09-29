import { and, eq, gte, sql } from 'drizzle-orm';
import { ugcAnonAbuseEvents, ugcAnonMutes } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { generateId } from '@/shared/utils/ulid';

export type AnonAbuseSubjectKind = 'ip' | 'device';

export type AnonAbuseSignal =
  | 'input_rejected'
  | 'rate_lockout'
  | 'policy_mute';

export const ANON_ABUSE_WEIGHTS: Record<AnonAbuseSignal, number> = {
  input_rejected: 1,
  rate_lockout: 2,
  policy_mute: 0,
};

export interface AnonAbuseSubject {
  kind: AnonAbuseSubjectKind;
  key: string;
}

export interface RecordAnonAbuseEventInput {
  subject: AnonAbuseSubject;
  signal: AnonAbuseSignal;
  weight?: number;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface UgcAnonAbuseRepository {
  record(input: RecordAnonAbuseEventInput): Promise<void>;
  sumWeightSince(subject: AnonAbuseSubject, since: Date): Promise<number>;
  getMutedUntil(subject: AnonAbuseSubject): Promise<Date | null>;
  setMutedUntil(subject: AnonAbuseSubject, mutedUntil: Date): Promise<void>;
}

export class UgcAnonAbuseRepositoryImpl implements UgcAnonAbuseRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(input: RecordAnonAbuseEventInput): Promise<void> {
    const weight = input.weight ?? ANON_ABUSE_WEIGHTS[input.signal] ?? 0;
    await this.db.insert(ugcAnonAbuseEvents).values({
      id: generateId(),
      subjectKind: input.subject.kind,
      subjectKey: input.subject.key,
      signal: input.signal,
      weight,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date(),
    });
  }

  async sumWeightSince(subject: AnonAbuseSubject, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${ugcAnonAbuseEvents.weight}), 0)` })
      .from(ugcAnonAbuseEvents)
      .where(
        and(
          eq(ugcAnonAbuseEvents.subjectKind, subject.kind),
          eq(ugcAnonAbuseEvents.subjectKey, subject.key),
          gte(ugcAnonAbuseEvents.createdAt, since),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async getMutedUntil(subject: AnonAbuseSubject): Promise<Date | null> {
    const [row] = await this.db
      .select({ mutedUntil: ugcAnonMutes.mutedUntil })
      .from(ugcAnonMutes)
      .where(
        and(
          eq(ugcAnonMutes.subjectKind, subject.kind),
          eq(ugcAnonMutes.subjectKey, subject.key),
        ),
      )
      .limit(1);
    return row?.mutedUntil ?? null;
  }

  async setMutedUntil(subject: AnonAbuseSubject, mutedUntil: Date): Promise<void> {
    const existing = await this.getMutedUntil(subject);
    if (existing && existing.getTime() >= mutedUntil.getTime()) return;

    await this.db
      .insert(ugcAnonMutes)
      .values({
        subjectKind: subject.kind,
        subjectKey: subject.key,
        mutedUntil,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ugcAnonMutes.subjectKind, ugcAnonMutes.subjectKey],
        set: { mutedUntil, updatedAt: new Date() },
      });
  }
}
