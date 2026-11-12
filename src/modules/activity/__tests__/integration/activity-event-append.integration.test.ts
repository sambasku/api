import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { ActivityEventRepositoryImpl } from '@/modules/activity/infrastructure/activity-event.repository.impl';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

/**
 * Append harus jalan tanpa ON CONFLICT…RETURNING (Turso staging menolak).
 * File SQLite di CI membuktikan jalur INSERT polos + dedupe update.
 */
describe.skipIf(!hasTestDb)(
  'ActivityEventRepositoryImpl.append (integration)',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let repo: ActivityEventRepositoryImpl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;
    const ACTOR = '01ACTAPPENDUSER';
    const JINYE_A = '01ACTAPPENDJINYEA';
    const JINYE_B = '01ACTAPPENDJINYEB';

    beforeAll(async () => {
      const { getTestDb } = await import('@/shared/database/drizzle/test-client');
      const { users, activityEvents } = await import(
        '@/shared/database/drizzle/schema'
      );
      const { truncateAll } = await import(
        '@/shared/database/drizzle/test-utils'
      );
      db = getTestDb();
      await truncateAll(db);
      await db.insert(users).values({
        id: ACTOR,
        username: 'act_append_user',
        displayName: 'Act Append',
        email: 'act-append@test.com',
        passwordHash: 'x',
      });
      // pastikan kosong
      await db.delete(activityEvents);
      repo = new ActivityEventRepositoryImpl(db);
    });

    it('menulis jinye_created dengan dedupeKey (insert polos)', async () => {
      const { activityEvents } = await import(
        '@/shared/database/drizzle/schema'
      );
      const result = await repo.append({
        kind: 'jinye_created',
        actorId: ACTOR,
        targetId: JINYE_A,
        dedupeKey: `jinye:${JINYE_A}`,
        payload: 'Jinye : hello',
      });
      expect(result).toBe('appended');
      const rows = await db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.dedupeKey, `jinye:${JINYE_A}`));
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe('jinye_created');
      expect(rows[0].payload).toBe('Jinye : hello');
    });

    it('dedupe ulang menimpa payload tanpa error', async () => {
      const { activityEvents } = await import(
        '@/shared/database/drizzle/schema'
      );
      await repo.append({
        kind: 'jinye_created',
        actorId: ACTOR,
        targetId: JINYE_B,
        dedupeKey: `jinye:${JINYE_B}`,
        payload: 'Jinye : pertama',
      });
      const again = await repo.append({
        kind: 'jinye_created',
        actorId: ACTOR,
        targetId: JINYE_B,
        dedupeKey: `jinye:${JINYE_B}`,
        payload: 'Jinye : kedua',
        hidden: false,
      });
      expect(again).toBe('appended');
      const rows = await db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.dedupeKey, `jinye:${JINYE_B}`));
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toBe('Jinye : kedua');
    });
  },
);
