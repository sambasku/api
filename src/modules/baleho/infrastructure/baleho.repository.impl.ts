import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  BALEHO_COLS,
  BALEHO_LOCKING_STATUSES,
  BALEHO_PAYMENT_TIMEOUT_MS,
  BALEHO_ROWS,
  balehoCommissions,
  balehoCreatives,
  balehoEvents,
  balehoFrames,
  balehoOccupancy,
  balehoPlacements,
  type BalehoPlacementStatus,
} from '@/shared/database/drizzle/schema/baleho.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { isUniqueViolation } from '@/shared/database/drizzle/sqlite-errors';
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

    // Semua status locking wajib tampil sebagai area terisi (buat semua viewer).
    // Konten frame hanya untuk live + milik sendiri (pending/awaiting).
    // Tanpa ini: orang lain lihat sel kosong → pesan → UNIQUE occupancy → 500/409.
    const contentCreativeIds = [
      ...new Set(
        rows
          .filter((p) => {
            if (p.status === 'live') return true;
            return (
              !!viewerUserId &&
              p.advertiserUserId === viewerUserId &&
              (p.status === 'pending_review' || p.status === 'awaiting_payment')
            );
          })
          .map((p) => p.creativeId),
      ),
    ];
    const frames =
      contentCreativeIds.length === 0
        ? []
        : await this.db
            .select()
            .from(balehoFrames)
            .where(inArray(balehoFrames.creativeId, contentCreativeIds))
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
        body: f.body,
        ctaLabel: f.ctaLabel,
        actionType: f.actionType,
        actionPayload: f.actionPayload,
      });
      framesByCreative.set(f.creativeId, list);
    }

    const placements: BalehoPlacementView[] = rows.map((p) => {
      const isOwner =
        !!viewerUserId && p.advertiserUserId === viewerUserId;
      const showContent =
        p.status === 'live' ||
        (isOwner &&
          (p.status === 'pending_review' || p.status === 'awaiting_payment'));
      return {
        id: p.id,
        slide: p.slide,
        col: p.col,
        row: p.row,
        w: p.w,
        h: p.h,
        status: p.status,
        advertiserUserId: p.advertiserUserId,
        isOwnerPending: isOwner && p.status !== 'live',
        frames: showContent ? (framesByCreative.get(p.creativeId) ?? []) : [],
        entityType: showContent ? p.entityType : null,
        entityId: showContent ? p.entityId : null,
      };
    });

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

  async hasActiveFingerprint(
    advertiserUserId: string,
    fingerprint: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: balehoPlacements.id })
      .from(balehoPlacements)
      .innerJoin(
        balehoCreatives,
        eq(balehoCreatives.id, balehoPlacements.creativeId),
      )
      .where(
        and(
          eq(balehoPlacements.advertiserUserId, advertiserUserId),
          isNull(balehoPlacements.deletedAt),
          inArray(
            balehoPlacements.status,
            BALEHO_LOCKING_STATUSES as BalehoPlacementStatus[],
          ),
          eq(balehoCreatives.fingerprint, fingerprint),
        ),
      )
      .limit(1);
    return rows.length > 0;
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

  async listApprovedCreatives(ownerUserId: string) {
    const creatives = await this.db
      .select({
        id: balehoCreatives.id,
        fingerprint: balehoCreatives.fingerprint,
      })
      .from(balehoCreatives)
      .where(
        and(
          eq(balehoCreatives.ownerUserId, ownerUserId),
          eq(balehoCreatives.moderationStatus, 'approved'),
          isNull(balehoCreatives.deletedAt),
        ),
      )
      .orderBy(desc(balehoCreatives.createdAt))
      .limit(50);
    if (creatives.length === 0) return [];

    const ids = creatives.map((c) => c.id);
    const frames = await this.db
      .select({
        creativeId: balehoFrames.creativeId,
        sortOrder: balehoFrames.sortOrder,
        title: balehoFrames.title,
        mediaUrl: balehoFrames.mediaUrl,
      })
      .from(balehoFrames)
      .where(inArray(balehoFrames.creativeId, ids))
      .orderBy(asc(balehoFrames.sortOrder));
    const firstFrame = new Map<
      string,
      { title: string | null; mediaUrl: string | null }
    >();
    for (const f of frames) {
      if (firstFrame.has(f.creativeId)) continue;
      firstFrame.set(f.creativeId, {
        title: f.title,
        mediaUrl: f.mediaUrl,
      });
    }

    const placements = await this.db
      .select({
        creativeId: balehoPlacements.creativeId,
        referrerUserId: balehoPlacements.referrerUserId,
        referralUsername: balehoPlacements.referralUsername,
        createdAt: balehoPlacements.createdAt,
      })
      .from(balehoPlacements)
      .where(
        and(
          inArray(balehoPlacements.creativeId, ids),
          isNull(balehoPlacements.deletedAt),
        ),
      )
      .orderBy(desc(balehoPlacements.createdAt));
    const lastRef = new Map<
      string,
      { referrerUserId: string | null; referralUsername: string | null }
    >();
    for (const p of placements) {
      if (lastRef.has(p.creativeId)) continue;
      lastRef.set(p.creativeId, {
        referrerUserId: p.referrerUserId,
        referralUsername: p.referralUsername,
      });
    }

    return creatives.map((c) => {
      const frame = firstFrame.get(c.id);
      const ref = lastRef.get(c.id);
      return {
        id: c.id,
        fingerprint: c.fingerprint,
        title: frame?.title ?? null,
        mediaUrl: frame?.mediaUrl ?? null,
        lastReferralUsername: ref?.referralUsername ?? null,
        lastReferrerUserId: ref?.referrerUserId ?? null,
      };
    });
  }

  async getLatestReferralForCreative(creativeId: string) {
    const rows = await this.db
      .select({
        referrerUserId: balehoPlacements.referrerUserId,
        referralUsername: balehoPlacements.referralUsername,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.creativeId, creativeId),
          isNull(balehoPlacements.deletedAt),
        ),
      )
      .orderBy(desc(balehoPlacements.createdAt))
      .limit(1);
    return rows[0] ?? null;
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
    days: number;
    pricePerCellPerDay: number;
    quotedAmount: number;
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
                body: f.body ?? null,
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
          days: args.days,
          pricePerCellPerDay: args.pricePerCellPerDay,
          quotedAmount: args.quotedAmount,
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
      // Drizzle bungkus LibSQL: "Failed query..." di message luar;
      // UNIQUE ada di cause → pakai helper yang telusuri rantai.
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          'SLOT_TAKEN',
          'Area ini baru saja terisi. Pilih yang lain ya.',
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
        advertiserUsername: users.username,
        referralUsername: balehoPlacements.referralUsername,
        paymentProofUrl: balehoPlacements.paymentProofUrl,
        quotedAmount: balehoPlacements.quotedAmount,
        pricePerCellPerDay: balehoPlacements.pricePerCellPerDay,
        days: balehoPlacements.days,
        createdAt: balehoPlacements.createdAt,
      })
      .from(balehoPlacements)
      .leftJoin(users, eq(users.id, balehoPlacements.advertiserUserId))
      .where(isNull(balehoPlacements.deletedAt))
      .orderBy(desc(balehoPlacements.createdAt))
      .limit(limit);

    const ids = rows.map((r) => r.id);
    const counts = new Map<string, { impressions: number; taps: number }>();
    if (ids.length > 0) {
      const stats = await this.db
        .select({
          placementId: balehoEvents.placementId,
          eventType: balehoEvents.eventType,
          n: sql<number>`count(*)`,
        })
        .from(balehoEvents)
        .where(inArray(balehoEvents.placementId, ids))
        .groupBy(balehoEvents.placementId, balehoEvents.eventType);
      for (const s of stats) {
        const cur = counts.get(s.placementId) ?? { impressions: 0, taps: 0 };
        const n = Number(s.n ?? 0);
        if (s.eventType === 'impression') cur.impressions = n;
        if (s.eventType === 'tap') cur.taps = n;
        counts.set(s.placementId, cur);
      }
    }

    return rows.map((r) => {
      const c = counts.get(r.id) ?? { impressions: 0, taps: 0 };
      return {
        ...r,
        advertiserUsername: r.advertiserUsername ?? null,
        paymentProofUrl: r.paymentProofUrl ?? null,
        quotedAmount: r.quotedAmount ?? null,
        pricePerCellPerDay: r.pricePerCellPerDay ?? null,
        days: r.days ?? null,
        createdAt: r.createdAt,
        impressions: c.impressions,
        taps: c.taps,
      };
    });
  }

  async listMine(advertiserUserId: string, limit: number) {
    const rows = await this.db
      .select({
        id: balehoPlacements.id,
        slide: balehoPlacements.slide,
        col: balehoPlacements.col,
        row: balehoPlacements.row,
        w: balehoPlacements.w,
        h: balehoPlacements.h,
        status: balehoPlacements.status,
        creativeId: balehoPlacements.creativeId,
        createdAt: balehoPlacements.createdAt,
        endsAt: balehoPlacements.endsAt,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.advertiserUserId, advertiserUserId),
          isNull(balehoPlacements.deletedAt),
        ),
      )
      .orderBy(desc(balehoPlacements.createdAt))
      .limit(limit);

    if (rows.length === 0) return [];

    const creativeIds = [...new Set(rows.map((r) => r.creativeId))];
    const frames = await this.db
      .select({
        creativeId: balehoFrames.creativeId,
        sortOrder: balehoFrames.sortOrder,
        title: balehoFrames.title,
        mediaUrl: balehoFrames.mediaUrl,
      })
      .from(balehoFrames)
      .where(inArray(balehoFrames.creativeId, creativeIds))
      .orderBy(asc(balehoFrames.sortOrder));
    const firstFrame = new Map<
      string,
      { title: string | null; mediaUrl: string | null }
    >();
    for (const f of frames) {
      if (firstFrame.has(f.creativeId)) continue;
      firstFrame.set(f.creativeId, {
        title: f.title,
        mediaUrl: f.mediaUrl,
      });
    }

    return rows.map((r) => {
      const frame = firstFrame.get(r.creativeId);
      return {
        id: r.id,
        slide: r.slide,
        col: r.col,
        row: r.row,
        w: r.w,
        h: r.h,
        status: r.status,
        title: frame?.title ?? null,
        mediaUrl: frame?.mediaUrl ?? null,
        createdAt: r.createdAt,
        endsAt: r.endsAt,
      };
    });
  }

  async getPlacementNotify(placementId: string) {
    const rows = await this.db
      .select({
        id: balehoPlacements.id,
        col: balehoPlacements.col,
        row: balehoPlacements.row,
        w: balehoPlacements.w,
        h: balehoPlacements.h,
        status: balehoPlacements.status,
        advertiserUserId: balehoPlacements.advertiserUserId,
        referrerUserId: balehoPlacements.referrerUserId,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.id, placementId),
          isNull(balehoPlacements.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getPaymentProof(placementId: string) {
    const rows = await this.db
      .select({
        paymentProofUrl: balehoPlacements.paymentProofUrl,
        paymentProofFileId: balehoPlacements.paymentProofFileId,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.id, placementId),
          isNull(balehoPlacements.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row?.paymentProofUrl?.trim() || !row.paymentProofFileId?.trim()) {
      return null;
    }
    return {
      paymentProofUrl: row.paymentProofUrl.trim(),
      paymentProofFileId: row.paymentProofFileId.trim(),
    };
  }

  async updatePlacementStatus(args: {
    placementId: string;
    status: BalehoPlacementStatus;
    rejectReason?: string | null;
    awaitingPaymentAt?: Date | null;
    paidAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    paymentProofUrl?: string | null;
    paymentProofFileId?: string | null;
    clearOccupancy?: boolean;
    approveCreative?: boolean;
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
          paymentProofUrl: args.paymentProofUrl ?? undefined,
          paymentProofFileId: args.paymentProofFileId ?? undefined,
          updatedAt: now,
        })
        .where(eq(balehoPlacements.id, args.placementId))
        .returning({
          id: balehoPlacements.id,
          creativeId: balehoPlacements.creativeId,
        });

      if (updated.length === 0) return false;

      if (args.approveCreative) {
        await tx
          .update(balehoCreatives)
          .set({
            moderationStatus: 'approved',
            updatedAt: now,
          })
          .where(eq(balehoCreatives.id, updated[0]!.creativeId));
      }

      if (args.clearOccupancy) {
        await tx
          .delete(balehoOccupancy)
          .where(eq(balehoOccupancy.placementId, args.placementId));
      }
      return true;
    });
  }

  async releaseDue(now: Date): Promise<{ cancelled: number; expired: number }> {
    const paymentCutoff = new Date(now.getTime() - BALEHO_PAYMENT_TIMEOUT_MS);

    const timedOut = await this.db
      .select({ id: balehoPlacements.id })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.status, 'awaiting_payment'),
          isNull(balehoPlacements.deletedAt),
          lte(balehoPlacements.awaitingPaymentAt, paymentCutoff),
        ),
      );
    const expiredLive = await this.db
      .select({ id: balehoPlacements.id })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.status, 'live'),
          isNull(balehoPlacements.deletedAt),
          lte(balehoPlacements.endsAt, now),
        ),
      );

    const cancelIds = timedOut.map((r) => r.id);
    const expireIds = expiredLive.map((r) => r.id);
    if (cancelIds.length === 0 && expireIds.length === 0) {
      return { cancelled: 0, expired: 0 };
    }

    await this.db.transaction(async (tx) => {
      if (cancelIds.length > 0) {
        await tx
          .update(balehoPlacements)
          .set({
            status: 'cancelled',
            rejectReason: 'payment_timeout',
            updatedAt: now,
          })
          .where(inArray(balehoPlacements.id, cancelIds));
        await tx
          .delete(balehoOccupancy)
          .where(inArray(balehoOccupancy.placementId, cancelIds));
      }
      if (expireIds.length > 0) {
        await tx
          .update(balehoPlacements)
          .set({
            status: 'expired',
            updatedAt: now,
          })
          .where(inArray(balehoPlacements.id, expireIds));
        await tx
          .delete(balehoOccupancy)
          .where(inArray(balehoOccupancy.placementId, expireIds));
      }
    });

    return { cancelled: cancelIds.length, expired: expireIds.length };
  }

  async createCommissionUnclaimed(args: {
    placementId: string;
    referrerUserId: string;
  }): Promise<void> {
    const now = new Date();
    try {
      await this.db.insert(balehoCommissions).values({
        id: generateId(),
        placementId: args.placementId,
        referrerUserId: args.referrerUserId,
        amount: 0,
        currency: 'IDR',
        status: 'unclaimed',
        createdAt: now,
      });
    } catch (err) {
      // Satu komisi per placement - mark-paid ulang tidak boleh 500.
      if (isUniqueViolation(err)) return;
      throw err;
    }
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
