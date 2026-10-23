import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import { users } from '@/shared/database/drizzle/schema';

import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { UserRepositoryImpl } from '../../infrastructure/user.repository.impl';

// Test hanya jalan kalau .env.test ada dengan DATABASE_URL test (api-base-stack.md Section 10)
const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

describe.skipIf(!hasTestDb)('UserRepositoryImpl', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = new UserRepositoryImpl(db);

  beforeEach(async () => {
    await truncateAll(db);
  });

  it('menyimpan dan mengambil user by email', async () => {
    await repo.save({ username: 'budi', email: 'budi@test.com', phone: null, passwordHash: 'hash' });
    const found = await repo.findByEmail('budi@test.com');
    expect(found?.username).toBe('budi');
    expect(found?.role).toBe('contributor'); // default dari skema DB
    expect(found?.emailVerified).toBe(false);
  });

  it('markEmailVerified mengubah email_verified jadi true', async () => {
    const saved = await repo.save({ username: 'siti', email: 'siti@test.com', phone: null, passwordHash: 'hash' });
    await repo.markEmailVerified(saved.id);
    expect((await repo.findById(saved.id))?.emailVerified).toBe(true);
    const [row] = await db.select().from(users).where(eq(users.id, saved.id)).limit(1);
    expect(row?.emailVerifiedAt).toBeInstanceOf(Date); // timeline welcome feed (#47)
  });

  it('findByUsername dan findById mengembalikan user yang sama', async () => {
    const saved = await repo.save({ username: 'siti', email: 'siti@test.com', phone: null, passwordHash: 'hash' });
    expect((await repo.findByUsername('siti'))?.id).toBe(saved.id);
    expect((await repo.findById(saved.id))?.email).toBe('siti@test.com');
  });

  it('list q angka cocok ke phone (08…/+62…/62… semua ketemu), q teks tidak', async () => {
    const saved = await repo.save({
      username: 'hp_owner',
      email: 'hp-owner@test.com',
      phone: '6281234567890',
      passwordHash: 'hash',
    });
    for (const q of ['081234567890', '+62 812-3456-7890', '6281234567890']) {
      const { items } = await repo.list({ q, limit: 20 });
      expect(items.map((u) => u.id)).toContain(saved.id);
    }
    expect((await repo.list({ q: 'tidak_ada', limit: 20 })).items).toHaveLength(0);
  });

  it('updatePassword mengubah password_hash', async () => {
    const saved = await repo.save({ username: 'rudi', email: 'rudi@test.com', phone: null, passwordHash: 'lama' });
    await repo.updatePassword(saved.id, 'baru');
    expect((await repo.findById(saved.id))?.passwordHash).toBe('baru');
  });
});
