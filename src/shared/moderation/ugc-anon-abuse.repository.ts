import { and, desc, eq, gt, gte, lt, sql } from 'drizzle-orm';
import { ugcAnonAbuseEvents, ugcAnonMutes } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { generateId } from '@/shared/utils/ulid';

export type AnonAbuseSubjectKind = 'ip' | 'device';

export type AnonAbuseSignal =
  | 'input_rejected'
  | 'rate_lockout'
  | 'policy_mute'
  /** Admin cabut mute - bobot negatif menetralkan skor rolling. */
  | 'admin_lift';

export const ANON_ABUSE_WEIGHTS: Record<AnonAbuseSignal, number> = {
  input_rejected: 1,
  rate_lockout: 2,
  policy_mute: 0,
  admin_lift: 0,
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

export interface AnonAbuseEvent {
  id: string;
  subjectKind: AnonAbuseSubjectKind;
  subjectKey: string;
  signal: string;
  weight: number;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AnonMute {
  subjectKind: AnonAbuseSubjectKind;
  subjectKey: string;
  mutedUntil: Date;
  updatedAt: Date | null;
}

export interface UgcAnonAbuseRepository {
  record(input: RecordAnonAbuseEventInput): Promise<void>;
  sumWeightSince(subject: AnonAbuseSubject, since: Date): Promise<number>;
  getMutedUntil(subject: AnonAbuseSubject): Promise<Date | null>;
  setMutedUntil(subject: AnonAbuseSubject, mutedUntil: Date): Promise<void>;
  listEvents(opts: {
    subjectKind?: AnonAbuseSubjectKind;
    subjectKey?: string;
    signal?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: AnonAbuseEvent[]; nextCursor: string | null; hasMore: boolean }>;
  listActiveMutes(limit: number): Promise<AnonMute[]>;
  /** true bila ada baris yang dihapus. */
  deleteMute(subject: AnonAbuseSubject): Promise<boolean>;
}

function parseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  // id ULID time-sortable: cursor `id < ?` = terbaru dulu (pola audit log).
  async listEvents(opts: {
    subjectKind?: AnonAbuseSubjectKind;
    subjectKey?: string;
    signal?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: AnonAbuseEvent[]; nextCursor: string | null; hasMore: boolean }> {
    const rows = await this.db
      .select()
      .from(ugcAnonAbuseEvents)
      .where(
        and(
          opts.subjectKind ? eq(ugcAnonAbuseEvents.subjectKind, opts.subjectKind) : undefined,
          opts.subjectKey ? eq(ugcAnonAbuseEvents.subjectKey, opts.subjectKey) : undefined,
          opts.signal ? eq(ugcAnonAbuseEvents.signal, opts.signal) : undefined,
          opts.cursor ? lt(ugcAnonAbuseEvents.id, opts.cursor) : undefined,
        ),
      )
      .orderBy(desc(ugcAnonAbuseEvents.id))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    return {
      items: page.map((row) => ({
        id: row.id,
        subjectKind: row.subjectKind as AnonAbuseSubjectKind,
        subjectKey: row.subjectKey,
        signal: row.signal,
        weight: row.weight,
        entityType: row.entityType ?? null,
        entityId: row.entityId ?? null,
        meta: parseMeta(row.meta),
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async listActiveMutes(limit: number): Promise<AnonMute[]> {
    const rows = await this.db
      .select()
      .from(ugcAnonMutes)
      .where(gt(ugcAnonMutes.mutedUntil, new Date()))
      .orderBy(desc(ugcAnonMutes.mutedUntil))
      .limit(limit);
    return rows.map((row) => ({
      subjectKind: row.subjectKind as AnonAbuseSubjectKind,
      subjectKey: row.subjectKey,
      mutedUntil: row.mutedUntil,
      updatedAt: row.updatedAt ?? null,
    }));
  }

  async deleteMute(subject: AnonAbuseSubject): Promise<boolean> {
    const deleted = await this.db
      .delete(ugcAnonMutes)
      .where(
        and(
          eq(ugcAnonMutes.subjectKind, subject.kind),
          eq(ugcAnonMutes.subjectKey, subject.key),
        ),
      )
      .returning({ key: ugcAnonMutes.subjectKey });
    return deleted.length > 0;
  }
}
