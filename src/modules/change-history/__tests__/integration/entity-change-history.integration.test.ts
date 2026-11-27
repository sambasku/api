import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { config } from 'dotenv';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;
if (parsed?.DATABASE_URL) process.env.DATABASE_URL = parsed.DATABASE_URL;

const LANG_ID = '01E2ELANGCH0000000000001';
const WORD_ID = '01E2EWORDCH0000000000001';
const PLACE_ID = '01E2EPLACECH000000000001';

/**
 * Riwayat perubahan: rekam via RecordEntityChange, baca via use case.
 * Budget subrequest (#103): endpoint publik <= 2 query (lookup slug + 1 JOIN riwayat).
 */
describe.skipIf(!hasTestDb)('Riwayat perubahan entitas (timeline)', () => {
  let queryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spyDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seedDb: any;

  beforeAll(async () => {
    const { getTestDb } = await import('@/shared/database/drizzle/test-client');
    const { users, words, places, languages } = await import('@/shared/database/drizzle/schema');
    const { truncateAll } = await import('@/shared/database/drizzle/test-utils');
    seedDb = getTestDb();
    await truncateAll(seedDb);
    await seedDb.insert(languages).values({ id: LANG_ID, code: 'sbb', name: 'Sambas' });
    await seedDb.insert(users).values([
      { id: 'u_ch1', username: 'budiaja', displayName: 'Budi', email: 'budi@test.com', passwordHash: 'x' },
      { id: 'u_ch2', username: 'sariaja', displayName: 'Sari', email: 'sari@test.com', passwordHash: 'x' },
    ]);
    await seedDb.insert(words).values({
      id: WORD_ID,
      lemma: 'makatn',
      languageId: LANG_ID,
      status: 'published',
      createdBy: 'u_ch1',
      wordType: 'word',
    });
    await seedDb.insert(places).values({
      id: PLACE_ID,
      slug: 'pantai-ch',
      name: 'Pantai CH',
      category: 'wisata',
      shortDescription: 'Pantai',
      status: 'published',
    });
  });

  beforeEach(async () => {
    const { createClient } = await import('@libsql/client');
    const { drizzle } = await import('drizzle-orm/libsql');
    const schema = await import('@/shared/database/drizzle/schema');
    const client = createClient({ url: process.env.DATABASE_URL! });
    const realExecute = client.execute.bind(client);
    queryCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).execute = async (...args: unknown[]) => {
      queryCount++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (realExecute as any)(...args);
    };
    spyDb = drizzle(client, { schema });
    await seedDb.delete(schema.auditLogs);
  });

  // ULID satu milidetik tidak monoton: jeda 3ms antar tulis agar urutan uji deterministik.
  async function makeAudit() {
    const { AuditLogRepositoryImpl } = await import('@/modules/audit/infrastructure/audit-log.repository.impl');
    const audit = new AuditLogRepositoryImpl(spyDb);
    const realRecord = audit.record.bind(audit);
    audit.record = async (entry) => {
      await realRecord(entry);
      await new Promise((r) => setTimeout(r, 3));
    };
    return audit;
  }

  async function build() {
    const { RecordEntityChange } = await import('../../application/record-entity-change');
    const { GetEntityChangeHistoryUseCase } = await import('../../application/get-entity-change-history.use-case');
    const { ChangeHistoryRepositoryImpl } = await import('../../infrastructure/change-history.repository.impl');
    const audit = await makeAudit();
    return {
      recorder: new RecordEntityChange(audit),
      history: new GetEntityChangeHistoryUseCase(new ChangeHistoryRepositoryImpl(spyDb)),
    };
  }

  it('wisata: create + update + foto tampil terbaru dulu, <= 2 query', async () => {
    const { recorder, history } = await build();
    const { placeSnapshot } = await import('../../domain/entity-change');
    const base = {
      name: 'Pantai CH',
      category: 'wisata',
      type: null,
      shortDescription: 'Pantai',
      hours: null,
      contact: null,
      mapsUrl: null,
      lat: null,
      lng: null,
      regionId: null,
      villageId: null,
      status: 'published',
      images: [],
    };
    await recorder.created('place', PLACE_ID, placeSnapshot(base), { actorId: 'u_ch1' });
    await recorder.updated(
      'place',
      PLACE_ID,
      placeSnapshot(base),
      placeSnapshot({ ...base, name: 'Pantai Indah', hours: '08.00-17.00' }),
      { actorId: 'u_ch2', sourceContributionId: 'c_1' },
    );
    await recorder.photosChanged('place', PLACE_ID, 'photo_add', 3, { actorId: 'u_ch1' });

    queryCount = 0;
    const page = await history.execute({ entityType: 'place', slug: 'pantai-ch', limit: 20 });
    expect(queryCount).toBeLessThanOrEqual(2);

    expect(page.items.map((i) => i.action)).toEqual(['photo_add', 'update', 'create']);
    expect(page.items[0]!.actionLabel).toBe('Menambah 3 foto');
    const update = page.items[1]!;
    expect(update.actor.displayName).toBe('Sari');
    expect(update.sourceContributionId).toBe('c_1');
    expect(update.changes.map((c) => [c.label, c.displayOld, c.displayNew])).toEqual([
      ['Nama', 'Pantai CH', 'Pantai Indah'],
      ['Jam buka', '-', '08.00-17.00'],
    ]);
    // Baris create cukup judul, tanpa daftar field.
    expect(page.items[2]!.changes).toEqual([]);
  });

  it('update tanpa perubahan tidak menulis baris; pindah status = publish/unpublish', async () => {
    const { recorder, history } = await build();
    const { placeSnapshot } = await import('../../domain/entity-change');
    const base = {
      name: 'Pantai CH', category: 'wisata', type: null, shortDescription: 'Pantai',
      hours: null, contact: null, mapsUrl: null, lat: null, lng: null,
      regionId: null, villageId: null, status: 'published', images: [],
    };
    await recorder.updated('place', PLACE_ID, placeSnapshot(base), placeSnapshot(base), { actorId: 'u_ch1' });
    await recorder.updated('place', PLACE_ID, placeSnapshot(base), placeSnapshot({ ...base, status: 'archived' }), { actorId: 'u_ch1' });
    await recorder.updated('place', PLACE_ID, placeSnapshot({ ...base, status: 'archived' }), placeSnapshot(base), { actorId: 'u_ch1' });

    const page = await history.execute({ entityType: 'place', slug: 'pantai-ch', limit: 20 });
    expect(page.items.map((i) => i.action)).toEqual(['publish', 'unpublish']);
    expect(page.items[1]!.changes[0]).toMatchObject({ label: 'Status', displayOld: 'Tayang', displayNew: 'Diarsipkan' });
  });

  it('cursor memotong halaman tanpa overlap', async () => {
    const { recorder, history } = await build();
    for (let i = 0; i < 3; i++) {
      await recorder.photosChanged('place', PLACE_ID, 'photo_add', i + 1, { actorId: 'u_ch1' });
    }
    const p1 = await history.execute({ entityType: 'place', slug: 'pantai-ch', limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    const p2 = await history.execute({ entityType: 'place', slug: 'pantai-ch', limit: 2, cursor: p1.nextCursor! });
    expect(p2.items).toHaveLength(1);
    expect(p2.hasMore).toBe(false);
    expect(p2.items[0]!.id).not.toBe(p1.items[1]!.id);
  });

  it('slug tak dikenal / bukan published = NotFound', async () => {
    const { history } = await build();
    await expect(history.execute({ entityType: 'place', slug: 'tidak-ada', limit: 5 })).rejects.toMatchObject({
      errorCode: 'PLACE_NOT_FOUND',
    });
    await expect(history.execute({ entityType: 'cuisine', slug: 'tidak-ada', limit: 5 })).rejects.toMatchObject({
      errorCode: 'CUISINE_NOT_FOUND',
    });
  });

  it('riwayat kata: aksi kata + aksi anak (arti, foto) tampil, entitas lain tidak', async () => {
    const { WordSuggestionRepositoryImpl } = await import(
      '@/modules/word-suggestions/infrastructure/word-suggestion.repository.impl'
    );
    const audit = await makeAudit();
    await audit.record({ userId: 'u_ch1', action: 'create', entityType: 'word', entityId: WORD_ID, newData: { lemma: 'makatn' } });
    await audit.record({ userId: 'u_ch2', action: 'create', entityType: 'meaning', entityId: 'm_1', newData: { word_id: WORD_ID, definition: 'makan' } });
    await audit.record({ userId: 'u_ch1', action: 'create', entityType: 'word_image', entityId: 'i_1', newData: { word_id: WORD_ID } });
    await audit.record({ userId: 'u_ch1', action: 'verify', entityType: 'meaning', entityId: 'm_1', oldData: { word_id: WORD_ID, is_verified: false }, newData: { word_id: WORD_ID, is_verified: true } });
    // Bukan anak kata: vote punya word_id tapi tidak boleh bocor ke timeline.
    await audit.record({ userId: 'u_ch1', action: 'create', entityType: 'vote', entityId: 'v_1', newData: { word_id: WORD_ID } });
    // Kata lain: tidak boleh ikut.
    await audit.record({ userId: 'u_ch1', action: 'create', entityType: 'meaning', entityId: 'm_9', newData: { word_id: 'w_lain' } });

    const repo = new WordSuggestionRepositoryImpl({} as never, {} as never);
    const page = await repo.getChangeHistory(WORD_ID, 20);
    expect(page.items.map((i) => [i.entity, i.action, i.actionLabel])).toEqual([
      ['meaning', 'verify', 'Arti diverifikasi'],
      ['word_image', 'create', 'Foto ditambahkan'],
      ['meaning', 'create', 'Arti ditambahkan'],
      ['word', 'create', 'Kata ditambahkan'],
    ]);
    const verify = page.items[0]!;
    expect(verify.changes.map((c) => [c.entity, c.field])).toEqual([['meaning', 'is_verified']]);
  });
});
