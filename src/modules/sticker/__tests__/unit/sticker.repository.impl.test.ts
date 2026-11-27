import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { StickerRepositoryImpl } from '../../infrastructure/sticker.repository.impl';

async function createMemoryDb() {
  const client = createClient({ url: ':memory:' });
  await client.execute(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE stickers (
      id TEXT PRIMARY KEY NOT NULL,
      image_url TEXT NOT NULL,
      play_once INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      category_slug TEXT,
      owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      provider_file_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      deleted_at INTEGER
    )
  `);
  await client.execute(`
    CREATE TABLE user_sticker_favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sticker_id TEXT NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, sticker_id)
    )
  `);
  await client.execute(`INSERT INTO users (id) VALUES ('user-a'), ('user-b')`);
  const db = drizzle(client, { schema }) as unknown as AppDatabase;
  return { client, db, repo: new StickerRepositoryImpl(db) };
}

describe('StickerRepositoryImpl (SQLite integration)', () => {
  let ctx: Awaited<ReturnType<typeof createMemoryDb>>;

  beforeEach(async () => {
    ctx = await createMemoryDb();
    await ctx.repo.create({
      id: 'cheer',
      imageUrl: 'https://cdn.example/cheer.png',
      categorySlug: 'reaksi',
      visibility: 'public',
    });
    await ctx.repo.create({
      id: 'kopi-01jabcdefghjkmnpqrstvwxyz1',
      imageUrl: 'https://ik.imagekit.io/demo/stickers/custom/kopi.webp',
      ownerUserId: 'user-a',
      displayName: 'Kopi Pagi',
      visibility: 'private',
      providerFileId: 'ik_kopi',
    });
  });

  it('listActivePage hanya mengembalikan stiker visibility=public (isolasi katalog)', async () => {
    const page = await ctx.repo.listActivePage({});
    expect(page.items.map((s) => s.id)).toEqual(['cheer']);
  });

  it('listByOwner hanya mengembalikan custom stiker milik pemiliknya', async () => {
    const mineA = await ctx.repo.listByOwner('user-a');
    const mineB = await ctx.repo.listByOwner('user-b');
    expect(mineA.map((s) => s.id)).toEqual(['kopi-01jabcdefghjkmnpqrstvwxyz1']);
    expect(mineB).toEqual([]);
  });

  it('findUsableByUser: viral favorite flow + budget 1 query', async () => {
    const customId = 'kopi-01jabcdefghjkmnpqrstvwxyz1';
    const spy = vi.spyOn(ctx.client, 'execute');

    // Pemilik boleh pakai
    expect((await ctx.repo.findUsableByUser(customId, 'user-a'))?.id).toBe(customId);
    expect(spy).toHaveBeenCalledTimes(1);

    // User lain belum favorit -> ditolak
    expect(await ctx.repo.findUsableByUser(customId, 'user-b')).toBeNull();

    // User lain favoritkan -> boleh pakai
    await ctx.repo.addFavorite('user-b', customId);
    expect((await ctx.repo.findUsableByUser(customId, 'user-b'))?.id).toBe(customId);

    // Publik boleh dipakai siapa saja
    expect((await ctx.repo.findUsableByUser('cheer', 'user-b'))?.id).toBe('cheer');
  });

  it('listFavorites = 1 query & otomatis menyembunyikan custom stiker yang dihapus pemilik', async () => {
    const customId = 'kopi-01jabcdefghjkmnpqrstvwxyz1';
    await ctx.repo.addFavorite('user-b', 'cheer');
    await ctx.repo.addFavorite('user-b', customId);

    const spy = vi.spyOn(ctx.client, 'execute');
    const favBefore = await ctx.repo.listFavorites('user-b');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(favBefore.map((s) => s.id).sort()).toEqual(['cheer', customId].sort());

    // Pemilik hapus custom stiker -> hilang dari favorit user B & tidak bisa dikirim lagi
    await ctx.repo.softDeleteByOwner(customId, 'user-a');
    const favAfter = await ctx.repo.listFavorites('user-b');
    expect(favAfter.map((s) => s.id)).toEqual(['cheer']);
    expect(await ctx.repo.findUsableByUser(customId, 'user-b')).toBeNull();
  });
});
