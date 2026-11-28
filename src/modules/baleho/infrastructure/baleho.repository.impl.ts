import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
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
import { words } from '@/shared/database/drizzle/schema/words.schema';
import { isUniqueViolation } from '@/shared/database/drizzle/sqlite-errors';
import { ConflictError } from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type {
  BalehoBoard,
  BalehoCreativeMeta,
  BalehoFrame,
  BalehoPlacementView,
  CreateBalehoPlacementInput,
  KosakataBoardStats,
} from '../domain/baleho';
import type { BalehoRepository } from '../domain/repositories/baleho.repository';
import {
  emptyEventCounts,
  fillDailySeries,
  startOfWibDayUtc,
  shiftCalendarDate,
  wibDateString,
  type BalehoDailyBucket,
  type BalehoEventCounts,
} from '../application/baleho-metrics';
import {
  placementBookingWindowStart,
  rectsOverlap,
  windowsOverlap,
} from '../domain/baleho-schedule';


function cellsFor(col: number, row: number, w: number, h: number) {
  const cells: Array<{ col: number; row: number }> = [];
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

function placementVisibleOnBoardAt(
  row: {
    scheduledStartsOn: Date | null;
    startsAt: Date | null;
    createdAt: Date;
    endsAt: Date | null;
  },
  now: Date,
): boolean {
  if (!row.endsAt || row.endsAt.getTime() < now.getTime()) return false;
  const start = placementBookingWindowStart(row);
  return start.getTime() <= now.getTime() && now.getTime() <= row.endsAt.getTime();
}

export class BalehoRepositoryImpl implements BalehoRepository {
  constructor(private readonly db: AppDatabase) {}

  async getBoard(
    slide: number,
    viewerUserId: string | null,
  ): Promise<BalehoBoard> {
    const rowsAll = await this.db
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

    const boardNow = new Date();
    const rows = rowsAll.filter((p) => placementVisibleOnBoardAt(p, boardNow));

    // Semua status locking wajib tampil sebagai area terisi (buat semua viewer).
    // Konten frame hanya untuk live + milik sendiri (pending/awaiting).
    // Tanpa ini: orang lain lihat sel kosong → pesan → UNIQUE occupancy → 500/409.
    const nowMs = Date.now();
    const contentCreativeIds = [
      ...new Set(
        rows
          .filter((p) => {
            if (p.status === 'live') {
              if (!p.startsAt) return true;
              return p.startsAt.getTime() <= nowMs;
            }
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
      const livePublic =
        p.status === 'live' &&
        (!p.startsAt || p.startsAt.getTime() <= nowMs);
      const showContent =
        livePublic ||
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

  async countKosakataStats(): Promise<KosakataBoardStats> {
    const rows = await this.db
      .select({
        total: sql<number>`coalesce(sum(case when ${words.status} != 'draft' then 1 else 0 end), 0)`,
        verified: sql<number>`coalesce(sum(case when ${words.isVerified} = 1 and ${words.status} = 'published' then 1 else 0 end), 0)`,
        queue: sql<number>`coalesce(sum(case when ${words.status} = 'pending_review' then 1 else 0 end), 0)`,
        rejected: sql<number>`coalesce(sum(case when ${words.status} = 'rejected' then 1 else 0 end), 0)`,
      })
      .from(words)
      .where(isNull(words.deletedAt));
    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      verified: Number(row?.verified ?? 0),
      queue: Number(row?.queue ?? 0),
      rejected: Number(row?.rejected ?? 0),
    };
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
      .where(eq(sql`lower(${users.username})`, username.toLowerCase()))
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

  async countFrames(creativeId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(balehoFrames)
      .where(eq(balehoFrames.creativeId, creativeId));
    return Number(rows[0]?.n ?? 0);
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
    const frameCount = new Map<string, number>();
    for (const f of frames) {
      frameCount.set(f.creativeId, (frameCount.get(f.creativeId) ?? 0) + 1);
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
        frameCount: frameCount.get(c.id) ?? 0,
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

  private async hasScheduleConflictInTx(
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    args: {
      slide: number;
      col: number;
      row: number;
      w: number;
      h: number;
      windowStart: Date;
      windowEnd: Date;
    },
  ): Promise<boolean> {
    const candidates = await tx
      .select({
        col: balehoPlacements.col,
        row: balehoPlacements.row,
        w: balehoPlacements.w,
        h: balehoPlacements.h,
        scheduledStartsOn: balehoPlacements.scheduledStartsOn,
        startsAt: balehoPlacements.startsAt,
        createdAt: balehoPlacements.createdAt,
        endsAt: balehoPlacements.endsAt,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.slide, args.slide),
          isNull(balehoPlacements.deletedAt),
          inArray(balehoPlacements.status, [
            ...BALEHO_LOCKING_STATUSES,
          ] as BalehoPlacementStatus[]),
        ),
      );
    const rect: { col: number; row: number; w: number; h: number } = {
      col: args.col,
      row: args.row,
      w: args.w,
      h: args.h,
    };
    for (const c of candidates) {
      if (!c.endsAt) continue;
      if (
        !rectsOverlap(rect, {
          col: c.col,
          row: c.row,
          w: c.w,
          h: c.h,
        })
      ) {
        continue;
      }
      const start = placementBookingWindowStart(c);
      if (
        windowsOverlap(start, c.endsAt, args.windowStart, args.windowEnd)
      ) {
        return true;
      }
    }
    return false;
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
    scheduledStartsOn: Date;
    confirmationPhone: string;
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

        const conflict = await this.hasScheduleConflictInTx(tx, {
          slide: input.slide,
          col: input.col,
          row: input.row,
          w: input.w,
          h: input.h,
          windowStart: args.scheduledStartsOn,
          windowEnd: args.endsAt!,
        });
        if (conflict) {
          throw new ConflictError(
            'SLOT_TAKEN',
            'Area ini bentrok dengan jadwal pesanan lain. Pilih tanggal atau area lain ya.',
          );
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
          scheduledStartsOn: args.scheduledStartsOn,
          confirmationPhone: args.confirmationPhone,
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
        scheduledStartsOn: balehoPlacements.scheduledStartsOn,
        startsAt: balehoPlacements.startsAt,
        endsAt: balehoPlacements.endsAt,
        confirmationPhone: balehoPlacements.confirmationPhone,
      })
      .from(balehoPlacements)
      .leftJoin(users, eq(users.id, balehoPlacements.advertiserUserId))
      .where(isNull(balehoPlacements.deletedAt))
      .orderBy(desc(balehoPlacements.createdAt))
      .limit(limit);

    const ids = rows.map((r) => r.id);
    const [counts, daily] = await Promise.all([
      this.eventCountsByPlacement(ids),
      this.eventDailyByPlacement(ids),
    ]);

    return rows.map((r) => {
      const c = counts.get(r.id) ?? emptyEventCounts();
      return {
        ...r,
        advertiserUsername: r.advertiserUsername ?? null,
        paymentProofUrl: r.paymentProofUrl ?? null,
        quotedAmount: r.quotedAmount ?? null,
        pricePerCellPerDay: r.pricePerCellPerDay ?? null,
        days: r.days ?? null,
        createdAt: r.createdAt,
        scheduledStartsOn: r.scheduledStartsOn ?? null,
        startsAt: r.startsAt ?? null,
        endsAt: r.endsAt ?? null,
        confirmationPhone: r.confirmationPhone ?? null,
        impressions: c.impressions,
        taps: c.taps,
        actions: c.actions,
        actionSuccess: c.actionSuccess,
        actionFail: c.actionFail,
        daily: daily.get(r.id) ?? [],
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
        quotedAmount: balehoPlacements.quotedAmount,
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

    const ids = rows.map((r) => r.id);
    const [counts, daily] = await Promise.all([
      this.eventCountsByPlacement(ids),
      this.eventDailyByPlacement(ids),
    ]);

    return rows.map((r) => {
      const frame = firstFrame.get(r.creativeId);
      const c = counts.get(r.id) ?? emptyEventCounts();
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
        quotedAmount: r.quotedAmount ?? null,
        impressions: c.impressions,
        taps: c.taps,
        actions: c.actions,
        actionSuccess: c.actionSuccess,
        actionFail: c.actionFail,
        daily: daily.get(r.id) ?? [],
      };
    });
  }

  /** Satu query GROUP BY untuk agregat event per placement (hemat subrequest). */
  private async eventCountsByPlacement(ids: string[]) {
    const counts = new Map<string, BalehoEventCounts>();
    if (ids.length === 0) return counts;
    const stats = await this.db
      .select({
        placementId: balehoEvents.placementId,
        eventType: balehoEvents.eventType,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(balehoEvents)
      .where(inArray(balehoEvents.placementId, ids))
      .groupBy(balehoEvents.placementId, balehoEvents.eventType);
    for (const s of stats) {
      const cur = counts.get(s.placementId) ?? emptyEventCounts();
      const n = Number(s.n ?? 0);
      if (s.eventType === 'impression') cur.impressions = n;
      else if (s.eventType === 'tap') cur.taps = n;
      else if (s.eventType === 'action') cur.actions = n;
      else if (s.eventType === 'action_success') cur.actionSuccess = n;
      else if (s.eventType === 'action_fail') cur.actionFail = n;
      counts.set(s.placementId, cur);
    }
    return counts;
  }

  /**
   * Tren harian WIB (7 hari) per placement - satu query GROUP BY
   * placement + hari + event_type.
   */
  private async eventDailyByPlacement(
    ids: string[],
    days = 7,
    now: Date = new Date(),
  ): Promise<Map<string, BalehoDailyBucket[]>> {
    const out = new Map<string, BalehoDailyBucket[]>();
    if (ids.length === 0) return out;

    const todayYmd = wibDateString(now);
    const windowStartYmd = shiftCalendarDate(todayYmd, -(days - 1));
    const since = startOfWibDayUtc(windowStartYmd);
    const dayExpr = sql<string>`strftime('%Y-%m-%d', ${balehoEvents.createdAt}, 'unixepoch', '+7 hours')`;

    const stats = await this.db
      .select({
        placementId: balehoEvents.placementId,
        day: dayExpr,
        eventType: balehoEvents.eventType,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(balehoEvents)
      .where(
        and(
          inArray(balehoEvents.placementId, ids),
          gte(balehoEvents.createdAt, since),
        ),
      )
      .groupBy(balehoEvents.placementId, dayExpr, balehoEvents.eventType);

    const raw = new Map<
      string,
      Map<string, { impressions: number; taps: number; actions: number }>
    >();
    for (const s of stats) {
      if (
        s.eventType !== 'impression' &&
        s.eventType !== 'tap' &&
        s.eventType !== 'action'
      ) {
        continue;
      }
      let byDay = raw.get(s.placementId);
      if (!byDay) {
        byDay = new Map();
        raw.set(s.placementId, byDay);
      }
      const cur = byDay.get(s.day) ?? {
        impressions: 0,
        taps: 0,
        actions: 0,
      };
      const n = Number(s.n ?? 0);
      if (s.eventType === 'impression') cur.impressions = n;
      else if (s.eventType === 'tap') cur.taps = n;
      else cur.actions = n;
      byDay.set(s.day, cur);
    }

    for (const id of ids) {
      const byDay = raw.get(id);
      const buckets = byDay
        ? [...byDay.entries()].map(([date, v]) => ({ date, ...v }))
        : [];
      out.set(
        id,
        fillDailySeries({ todayYmd, days, raw: buckets }),
      );
    }
    return out;
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
        endsAt: balehoPlacements.endsAt,
        scheduledStartsOn: balehoPlacements.scheduledStartsOn,
        days: balehoPlacements.days,
        confirmationPhone: balehoPlacements.confirmationPhone,
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
          // null = clear alasan; undefined = biarkan kolom lama.
          rejectReason:
            args.rejectReason === undefined ? undefined : args.rejectReason,
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
          inArray(balehoPlacements.status, ['live', 'paused']),
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

  async listEndingSoon(
    now: Date,
    until: Date,
  ): Promise<Array<{ id: string; advertiserUserId: string }>> {
    return this.db
      .select({
        id: balehoPlacements.id,
        advertiserUserId: balehoPlacements.advertiserUserId,
      })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.status, 'live'),
          isNull(balehoPlacements.deletedAt),
          isNull(balehoPlacements.endingSoonNotifiedAt),
          gt(balehoPlacements.endsAt, now),
          lte(balehoPlacements.endsAt, until),
        ),
      );
  }

  async markEndingSoonNotified(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(balehoPlacements)
      .set({
        endingSoonNotifiedAt: at,
        updatedAt: at,
      })
      .where(inArray(balehoPlacements.id, ids));
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
