import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  BALEHO_COLS,
  BALEHO_LOCKING_STATUSES,
  BALEHO_ROWS,
  balehoCreatives,
  balehoFrames,
  balehoOccupancy,
  balehoPlacements,
  type BalehoPlacementStatus,
} from '@/shared/database/drizzle/schema/baleho.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { ConflictError } from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type {
  BalehoBoard,
  BalehoCreativeMeta,
  BalehoFrame,
  BalehoPlacementView,
  CreateBalehoPlacementInput,
} from '../domain/baleho';
import type { BalehoRepository } from '../domain/repositories/baleho.repository';
import { balehoEvents } from '@/shared/database/drizzle/schema/baleho.schema';

function cellsFor(col: number, row: number, w: number, h: number) {
  const cells: Array<{ col: number; row: number }> = [];
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

export class BalehoRepositoryImpl implements BalehoRepository {
  constructor(private readonly db: AppDatabase) {}

  async getBoard(
    slide: number,
    viewerUserId: string | null,
  ): Promise<BalehoBoard> {
    const rows = await this.db
      .select()
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.slide, slide),
          isNull(balehoPlacements.deletedAt),
          inArray(balehoPlacements.status, [
            ...BALEHO_LOCKING_STATUSES,
          ] as BalehoPlacementStatus[]),
        ),
      )
      .orderBy(asc(balehoPlacements.row), asc(balehoPlacements.col));

    const visible = rows.filter((p) => {
      if (p.status === 'live') return true;
      if (
        viewerUserId &&
        p.advertiserUserId === viewerUserId &&
        (p.status === 'pending_review' || p.status === 'awaiting_payment')
      ) {
        return true;
      }
      return false;
    });

    const creativeIds = [...new Set(visible.map((p) => p.creativeId))];
    const frames =
      creativeIds.length === 0
        ? []
        : await this.db
            .select()
            .from(balehoFrames)
            .where(inArray(balehoFrames.creativeId, creativeIds))
            .orderBy(asc(balehoFrames.sortOrder));

    const framesByCreative = new Map<string, BalehoFrame[]>();
    for (const f of frames) {
      const list = framesByCreative.get(f.creativeId) ?? [];
      list.push({
        id: f.id,
        sortOrder: f.sortOrder,
        mediaType: f.mediaType,
        mediaUrl: f.mediaUrl,
        title: f.title,
        ctaLabel: f.ctaLabel,
        actionType: f.actionType,
        actionPayload: f.actionPayload,
      });
      framesByCreative.set(f.creativeId, list);
    }

    const placements: BalehoPlacementView[] = visible.map((p) => ({
      id: p.id,
      slide: p.slide,
      col: p.col,
      row: p.row,
      w: p.w,
      h: p.h,
      status: p.status,
      advertiserUserId: p.advertiserUserId,
      isOwnerPending:
        !!viewerUserId &&
        p.advertiserUserId === viewerUserId &&
        p.status !== 'live',
      frames: framesByCreative.get(p.creativeId) ?? [],
      entityType: p.entityType,
      entityId: p.entityId,
    }));

    return { slide, cols: BALEHO_COLS, rows: BALEHO_ROWS, placements };
  }

  async countActiveForUser(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.advertiserUserId, userId),
          isNull(balehoPlacements.deletedAt),
          inArray(
            balehoPlacements.status,
            BALEHO_LOCKING_STATUSES as BalehoPlacementStatus[],
          ),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  }

  async findUserIdByUsername(username: string) {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows[0] ?? null;
  }

  async getCreativeForOwner(
    creativeId: string,
    ownerUserId: string,
  ): Promise<BalehoCreativeMeta | null> {
    const rows = await this.db
      .select()
      .from(balehoCreatives)
      .where(
        and(
          eq(balehoCreatives.id, creativeId),
          eq(balehoCreatives.ownerUserId, ownerUserId),
          isNull(balehoCreatives.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      fingerprint: row.fingerprint,
      moderationStatus: row.moderationStatus,
    };
  }

  async createPlacement(args: {
    advertiserUserId: string;
    input: CreateBalehoPlacementInput;
    fingerprint: string;
    referrerUserId: string | null;
    referralUsername: string | null;
    status: BalehoPlacementStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    awaitingPaymentAt: Date | null;
  }): Promise<{ placementId: string; creativeId: string }> {
    const { input } = args;
    const now = new Date();
    const cells = cellsFor(input.col, input.row, input.w, input.h);
    const placementId = generateId();
    let creativeId = input.creativeId ?? generateId();

    try {
      await this.db.transaction(async (tx) => {
        if (!input.creativeId) {
          await tx.insert(balehoCreatives).values({
            id: creativeId,
            ownerUserId: args.advertiserUserId,
            fingerprint: args.fingerprint,
            moderationStatus:
              args.status === 'awaiting_payment' ? 'approved' : 'pending',
            createdAt: now,
          });
          if (input.frames.length > 0) {
            await tx.insert(balehoFrames).values(
              input.frames.map((f, i) => ({
                id: generateId(),
                creativeId,
                sortOrder: i,
                mediaType: f.mediaType,
                mediaUrl: f.mediaUrl ?? null,
                title: f.title ?? null,
                ctaLabel: f.ctaLabel ?? null,
                actionType: f.actionType,
                actionPayload: f.actionPayload,
                createdAt: now,
              })),
            );
          }
        }

        await tx.insert(balehoPlacements).values({
          id: placementId,
          creativeId,
          slide: input.slide,
          col: input.col,
          row: input.row,
          w: input.w,
          h: input.h,
          status: args.status,
          advertiserUserId: args.advertiserUserId,
          referrerUserId: args.referrerUserId,
          referralUsername: args.referralUsername,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          startsAt: args.startsAt,
          endsAt: args.endsAt,
          awaitingPaymentAt: args.awaitingPaymentAt,
          createdAt: now,
        });

        await tx.insert(balehoOccupancy).values(
          cells.map((c) => ({
            slide: input.slide,
            col: c.col,
            row: c.row,
            placementId,
          })),
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE|unique|constraint/i.test(msg)) {
        throw new ConflictError(
          'SLOT_TAKEN',
          'Slot ini baru saja terisi. Pilih area lain ya.',
        );
      }
      throw err;
    }

    return { placementId, creativeId };
  }

  async listAdmin(limit: number) {
    const rows = await this.db
      .select({
        id: balehoPlacements.id,
        slide: balehoPlacements.slide,
        col: balehoPlacements.col,
        row: balehoPlacements.row,
        w: balehoPlacements.w,
        h: balehoPlacements.h,
        status: balehoPlacements.status,
        advertiserUserId: balehoPlacements.advertiserUserId,
        referralUsername: balehoPlacements.referralUsername,
        createdAt: balehoPlacements.createdAt,
      })
      .from(balehoPlacements)
      .where(isNull(balehoPlacements.deletedAt))
      .orderBy(desc(balehoPlacements.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt,
    }));
  }

  async updatePlacementStatus(args: {
    placementId: string;
    status: BalehoPlacementStatus;
    rejectReason?: string | null;
    awaitingPaymentAt?: Date | null;
    paidAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    clearOccupancy?: boolean;
  }): Promise<boolean> {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(balehoPlacements)
        .set({
          status: args.status,
          rejectReason: args.rejectReason ?? undefined,
          rejectedAt: args.status === 'rejected' ? now : undefined,
          awaitingPaymentAt: args.awaitingPaymentAt ?? undefined,
          paidAt: args.paidAt ?? undefined,
          startsAt: args.startsAt ?? undefined,
          endsAt: args.endsAt ?? undefined,
          updatedAt: now,
        })
        .where(eq(balehoPlacements.id, args.placementId))
        .returning({ id: balehoPlacements.id });

      if (updated.length === 0) return false;

      if (args.clearOccupancy) {
        await tx
          .delete(balehoOccupancy)
          .where(eq(balehoOccupancy.placementId, args.placementId));
      }
      return true;
    });
  }

  async recordEvent(args: {
    placementId: string;
    frameId: string | null;
    eventType: string;
  }): Promise<void> {
    await this.db.insert(balehoEvents).values({
      id: generateId(),
      placementId: args.placementId,
      frameId: args.frameId,
      eventType: args.eventType as never,
      createdAt: new Date(),
    });
  }
}
