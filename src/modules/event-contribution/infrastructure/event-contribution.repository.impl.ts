import { and, count, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/shared/database/drizzle/client";
import {
  eventContributions,
  type EventContributionStatus,
} from "@/shared/database/drizzle/schema/event-contributions.schema";
import { generateId } from "@/shared/utils/ulid";
import type {
  EventContribution,
  EventContributionPayload,
} from "../domain/entities/event-contribution.entity";

function mapRow(
  row: typeof eventContributions.$inferSelect,
): EventContribution {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId ?? null,
    payload: JSON.parse(row.payloadJson) as EventContributionPayload,
    status: row.status,
    revisionNote: row.revisionNote ?? null,
    rejectReasonCode: row.rejectReasonCode ?? null,
    rejectReasonText: row.rejectReasonText ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
  };
}

export class EventContributionRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    userId: string;
    payload: EventContributionPayload;
  }): Promise<EventContribution> {
    const id = generateId();
    await this.db.insert(eventContributions).values({
      id,
      userId: input.userId,
      payloadJson: JSON.stringify(input.payload),
      status: "pending",
    });
    const row = await this.findById(id);
    if (!row) throw new Error("event contribution insert failed");
    return row;
  }

  async findById(id: string): Promise<EventContribution | null> {
    const [row] = await this.db
      .select()
      .from(eventContributions)
      .where(eq(eventContributions.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<EventContribution[]> {
    const rows = await this.db
      .select()
      .from(eventContributions)
      .where(eq(eventContributions.userId, userId))
      .orderBy(desc(eventContributions.createdAt))
      .limit(50);
    return rows.map(mapRow);
  }

  async listByStatus(
    status: EventContributionStatus,
  ): Promise<EventContribution[]> {
    const rows = await this.db
      .select()
      .from(eventContributions)
      .where(eq(eventContributions.status, status))
      .orderBy(desc(eventContributions.createdAt))
      .limit(100);
    return rows.map(mapRow);
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(eventContributions)
      .where(
        and(
          eq(eventContributions.userId, userId),
          eq(eventContributions.status, "pending"),
        ),
      );
    return row?.total ?? 0;
  }

  async setStatus(
    id: string,
    status: EventContributionStatus,
    extra?: {
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      eventId?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(eventContributions)
      .set({
        status,
        updatedAt: new Date(),
        reviewedAt: status === "pending" ? null : new Date(),
        ...(extra?.revisionNote !== undefined
          ? { revisionNote: extra.revisionNote }
          : {}),
        ...(extra?.rejectReasonCode !== undefined
          ? { rejectReasonCode: extra.rejectReasonCode }
          : {}),
        ...(extra?.rejectReasonText !== undefined
          ? { rejectReasonText: extra.rejectReasonText }
          : {}),
        ...(extra?.eventId !== undefined ? { eventId: extra.eventId } : {}),
      })
      .where(eq(eventContributions.id, id));
  }

  /** Simpan payload baru (resubmit setelah revisi) lalu status kembali pending. */
  async replacePayload(
    id: string,
    payload: EventContributionPayload,
  ): Promise<void> {
    await this.db
      .update(eventContributions)
      .set({
        payloadJson: JSON.stringify(payload),
        status: "pending",
        revisionNote: null,
        updatedAt: new Date(),
        reviewedAt: null,
      })
      .where(eq(eventContributions.id, id));
  }

  async remove(id: string): Promise<void> {
    await this.db
      .delete(eventContributions)
      .where(eq(eventContributions.id, id));
  }
}
