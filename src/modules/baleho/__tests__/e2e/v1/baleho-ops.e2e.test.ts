import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { and, eq, inArray } from 'drizzle-orm';
import { e2eRegisterBody } from '@/shared/testing/e2e-auth';
import { e2eBalehoStartsOn } from '@/shared/testing/baleho-e2e';
import {
  BALEHO_PAYMENT_TIMEOUT_MS,
} from '@/shared/database/drizzle/schema/baleho.schema';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

function placementBody(over: Record<string, unknown> = {}) {
  return {
    slide: 1,
    col: 0,
    row: 0,
    w: 1,
    h: 1,
    days: 7,
    starts_on: e2eBalehoStartsOn(),
    confirmation_phone: '6281234567890',
    frames: [
      {
        media_type: 'image',
        media_url: 'https://cdn.example.com/baleho-e2e.jpg',
        title: 'E2E Baleho',
        cta_label: 'Buka',
        action_type: 'external',
        action_payload: 'https://contoh.id/e2e',
      },
    ],
    ...over,
  };
}

describe.skipIf(!hasTestDb)('Baleho P4 ops - race / kuota / fingerprint / release', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let adminToken: string;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const post = (path: string, body: unknown, token?: string) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, userRoles } = await import(
      '@/shared/database/drizzle/schema'
    );
    db = getTestDb();
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    await truncateAll(db);

    const appModule = await import('@/app');
    app = appModule.app;

    const stamp = Date.now();
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `ba${stamp}`, email: `ba${stamp}@test.com` }),
    );
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `bb${stamp}`, email: `bb${stamp}@test.com` }),
    );
    await post(
      '/api/v1/auth/register',
      e2eRegisterBody({ name: `adm${stamp}`, email: `adm${stamp}@test.com` }),
    );
    await db.update(users).set({ emailVerified: true });

    const [a] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `ba${stamp}@test.com`))
      .limit(1);
    const [b] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `bb${stamp}@test.com`))
      .limit(1);
    const [adm] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, `adm${stamp}@test.com`))
      .limit(1);
    userAId = a.id;
    userBId = b.id;
    await db
      .insert(userRoles)
      .values({ userId: adm.id, role: 'admin' })
      .onConflictDoNothing();

    const login = async (email: string) => {
      const res = await post('/api/v1/auth/login', {
        email,
        password: 'Password123',
      });
      return ((await res.json()) as { data: { access_token: string } }).data
        .access_token;
    };
    userAToken = await login(`ba${stamp}@test.com`);
    userBToken = await login(`bb${stamp}@test.com`);
    adminToken = await login(`adm${stamp}@test.com`);
  });

  it('race dua submit overlap → satu 201 satu 409 SLOT_TAKEN', async () => {
    const { balehoOccupancy, balehoPlacements } = await import(
      '@/shared/database/drizzle/schema/baleho.schema'
    );
    // Bersihkan slot (0,0) supaya race bersih.
    const occ = await db
      .select({ placementId: balehoOccupancy.placementId })
      .from(balehoOccupancy)
      .where(
        and(
          eq(balehoOccupancy.slide, 1),
          eq(balehoOccupancy.col, 0),
          eq(balehoOccupancy.row, 0),
        ),
      );
    if (occ.length > 0) {
      const ids = occ.map((o: { placementId: string }) => o.placementId);
      await db
        .delete(balehoOccupancy)
        .where(inArray(balehoOccupancy.placementId, ids));
      await db
        .update(balehoPlacements)
        .set({ status: 'cancelled' })
        .where(inArray(balehoPlacements.id, ids));
    }

    const bodyA = placementBody({
      col: 0,
      row: 0,
      frames: [
        {
          media_type: 'image',
          media_url: 'https://cdn.example.com/race-a.jpg',
          title: 'Race A',
          cta_label: 'Buka',
          action_type: 'external',
          action_payload: 'https://contoh.id/race-a',
        },
      ],
    });
    const bodyB = placementBody({
      col: 0,
      row: 0,
      frames: [
        {
          media_type: 'image',
          media_url: 'https://cdn.example.com/race-b.jpg',
          title: 'Race B',
          cta_label: 'Buka',
          action_type: 'external',
          action_payload: 'https://contoh.id/race-b',
        },
      ],
    });

    const [resA, resB] = await Promise.all([
      post('/api/v1/baleho/placements', bodyA, userAToken),
      post('/api/v1/baleho/placements', bodyB, userBToken),
    ]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
    const bodies = await Promise.all([resA.json(), resB.json()]);
    const err = bodies.find((b: { success?: boolean }) => b.success === false);
    expect(err?.error_code).toBe('SLOT_TAKEN');
  });

  it('max 2 pesanan aktif / user → 409 BALEHO_ACTIVE_LIMIT', async () => {
    const { balehoPlacements, balehoOccupancy } = await import(
      '@/shared/database/drizzle/schema/baleho.schema'
    );
    // Reset kuota user A: batalkan semua aktif + lepas slot.
    const activeA = await db
      .select({ id: balehoPlacements.id })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.advertiserUserId, userAId),
          inArray(balehoPlacements.status, [
            'pending_review',
            'awaiting_payment',
            'live',
          ]),
        ),
      );
    if (activeA.length > 0) {
      const ids = activeA.map((r: { id: string }) => r.id);
      await db
        .delete(balehoOccupancy)
        .where(inArray(balehoOccupancy.placementId, ids));
      await db
        .update(balehoPlacements)
        .set({ status: 'cancelled' })
        .where(inArray(balehoPlacements.id, ids));
    }

    const mk = (col: number, row: number, tag: string) =>
      placementBody({
        col,
        row,
        frames: [
          {
            media_type: 'image',
            media_url: `https://cdn.example.com/${tag}.jpg`,
            title: tag,
            cta_label: 'Buka',
            action_type: 'external',
            action_payload: `https://contoh.id/${tag}`,
          },
        ],
      });

    const first = await post(
      '/api/v1/baleho/placements',
      mk(0, 1, 'limit-1'),
      userAToken,
    );
    const second = await post(
      '/api/v1/baleho/placements',
      mk(0, 2, 'limit-2'),
      userAToken,
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const third = await post(
      '/api/v1/baleho/placements',
      mk(3, 4, 'limit-3'),
      userAToken,
    );
    expect(third.status).toBe(409);
    const body = await third.json();
    expect(body.error_code).toBe('BALEHO_ACTIVE_LIMIT');
  });

  it('konten+action seragam ditolak (fingerprint)', async () => {
    const { balehoPlacements, balehoOccupancy } = await import(
      '@/shared/database/drizzle/schema/baleho.schema'
    );
    // Lepas semua pesanan aktif user B supaya kuota bersih untuk tes fingerprint.
    const activeB = await db
      .select({ id: balehoPlacements.id })
      .from(balehoPlacements)
      .where(
        and(
          eq(balehoPlacements.advertiserUserId, userBId),
          inArray(balehoPlacements.status, [
            'pending_review',
            'awaiting_payment',
            'live',
          ]),
        ),
      );
    if (activeB.length > 0) {
      const ids = activeB.map((r: { id: string }) => r.id);
      await db
        .delete(balehoOccupancy)
        .where(inArray(balehoOccupancy.placementId, ids));
      await db
        .update(balehoPlacements)
        .set({ status: 'cancelled' })
        .where(inArray(balehoPlacements.id, ids));
    }

    const sameFrames = [
      {
        media_type: 'image',
        media_url: 'https://cdn.example.com/same.jpg',
        title: 'Sama',
        cta_label: 'Buka',
        action_type: 'external',
        action_payload: 'https://contoh.id/same',
      },
    ];
    const first = await post(
      '/api/v1/baleho/placements',
      placementBody({ col: 2, row: 0, frames: sameFrames }),
      userBToken,
    );
    expect(first.status).toBe(201);

    const second = await post(
      '/api/v1/baleho/placements',
      placementBody({ col: 3, row: 0, frames: sameFrames }),
      userBToken,
    );
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error_code).toBe('BALEHO_FINGERPRINT_DUP');
  });

  it('releaseDue: timeout 48 jam → cancelled; ends_at lewat → expired', async () => {
    const {
      balehoPlacements,
      balehoOccupancy,
      balehoCreatives,
      balehoFrames,
    } = await import('@/shared/database/drizzle/schema/baleho.schema');
    const { generateId } = await import('@/shared/utils/ulid');
    const { runDueBalehoRelease } = await import('@/app');

    const now = new Date();
    const timeoutCreative = generateId();
    const timeoutPlacement = generateId();
    const expireCreative = generateId();
    const expirePlacement = generateId();

    await db.insert(balehoCreatives).values([
      {
        id: timeoutCreative,
        ownerUserId: userBId,
        fingerprint: `timeout-${Date.now()}`,
        moderationStatus: 'approved',
        createdAt: now,
      },
      {
        id: expireCreative,
        ownerUserId: userBId,
        fingerprint: `expire-${Date.now()}`,
        moderationStatus: 'approved',
        createdAt: now,
      },
    ]);
    await db.insert(balehoFrames).values([
      {
        id: generateId(),
        creativeId: timeoutCreative,
        sortOrder: 0,
        mediaType: 'image',
        mediaUrl: 'https://cdn.example.com/to.jpg',
        title: 'TO',
        ctaLabel: 'Buka',
        actionType: 'external',
        actionPayload: 'https://contoh.id/to',
        createdAt: now,
      },
      {
        id: generateId(),
        creativeId: expireCreative,
        sortOrder: 0,
        mediaType: 'image',
        mediaUrl: 'https://cdn.example.com/ex.jpg',
        title: 'EX',
        ctaLabel: 'Buka',
        actionType: 'external',
        actionPayload: 'https://contoh.id/ex',
        createdAt: now,
      },
    ]);

    const awaitingAt = new Date(now.getTime() - BALEHO_PAYMENT_TIMEOUT_MS - 60_000);
    const endedAt = new Date(now.getTime() - 60_000);

    await db.insert(balehoPlacements).values([
      {
        id: timeoutPlacement,
        creativeId: timeoutCreative,
        slide: 1,
        col: 1,
        row: 4,
        w: 1,
        h: 1,
        status: 'awaiting_payment',
        advertiserUserId: userBId,
        awaitingPaymentAt: awaitingAt,
        endsAt: new Date(now.getTime() + 7 * 86400000),
        createdAt: now,
      },
      {
        id: expirePlacement,
        creativeId: expireCreative,
        slide: 1,
        col: 2,
        row: 4,
        w: 1,
        h: 1,
        status: 'live',
        advertiserUserId: userBId,
        startsAt: new Date(now.getTime() - 2 * 86400000),
        endsAt: endedAt,
        paidAt: new Date(now.getTime() - 2 * 86400000),
        createdAt: now,
      },
    ]);
    await db.insert(balehoOccupancy).values([
      { slide: 1, col: 1, row: 4, placementId: timeoutPlacement },
      { slide: 1, col: 2, row: 4, placementId: expirePlacement },
    ]);

    const result = await runDueBalehoRelease();
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const [toRow] = await db
      .select({ status: balehoPlacements.status })
      .from(balehoPlacements)
      .where(eq(balehoPlacements.id, timeoutPlacement))
      .limit(1);
    const [exRow] = await db
      .select({ status: balehoPlacements.status })
      .from(balehoPlacements)
      .where(eq(balehoPlacements.id, expirePlacement))
      .limit(1);
    expect(toRow.status).toBe('cancelled');
    expect(exRow.status).toBe('expired');

    const leftOcc = await db
      .select({ id: balehoOccupancy.placementId })
      .from(balehoOccupancy)
      .where(
        inArray(balehoOccupancy.placementId, [
          timeoutPlacement,
          expirePlacement,
        ]),
      );
    expect(leftOcc).toHaveLength(0);

    // Admin token dipakai supaya route tetap ter-wire (hindari unused).
    expect(adminToken.length).toBeGreaterThan(10);
  });
});
