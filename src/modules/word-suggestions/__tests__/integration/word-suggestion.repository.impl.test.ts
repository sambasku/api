import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { getTestDb } from '@/shared/database/drizzle/test-client';
import {
  languages,
  lexicalRelations,
  meanings,
  users,
  wordEditSuggestions,
  words,
} from '@/shared/database/drizzle/schema';
import { truncateAll } from '@/shared/database/drizzle/test-utils';
import { WordSuggestionRepositoryImpl } from '../../infrastructure/word-suggestion.repository.impl';
import { ActivityRepositoryImpl } from '@/modules/activity/infrastructure/activity.repository.impl';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

const ulid26 = (prefix: string) => prefix.padEnd(26, '0').slice(0, 26);
const SMB = ulid26('01TESTLANGSMB');
const OWNER = ulid26('01TESTOWNERUSR');
const KONTRIBUTOR = ulid26('01TESTKONTRIB');
const REVIEWER = ulid26('01TESTREVIEW');
const WORD = ulid26('01TESTWORDSUG');

const noopPublic = {} as PublicImageStoragePort;
const noopImage = {} as ImageStoragePort;

describe.skipIf(!hasTestDb)('WordSuggestionRepositoryImpl.createSuggestion', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = new WordSuggestionRepositoryImpl(noopPublic, noopImage);

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(users).values([
      { id: OWNER, username: 'owner', email: 'owner@test.com', passwordHash: 'x', role: 'contributor' },
      {
        id: KONTRIBUTOR,
        username: 'kontributor',
        email: 'kon@test.com',
        passwordHash: 'x',
        role: 'contributor',
      },
      { id: REVIEWER, username: 'reviewer', email: 'rev@test.com', passwordHash: 'x', role: 'reviewer' },
    ]);
    await db.insert(languages).values({ id: SMB, code: 'smb', name: 'Sambas' });
    await db.insert(words).values({
      id: WORD,
      languageId: SMB,
      lemma: 'kete',
      notes: 'lama',
      status: 'published',
      isVerified: true,
      createdBy: OWNER,
      verifiedBy: OWNER,
      verifiedAt: new Date(),
    });
  });

  it('contributor → status pending, notes kata belum berubah', async () => {
    const suggestion = await repo.createSuggestion(
      KONTRIBUTOR,
      WORD,
      { notes: 'baru dari kontributor' },
      'Perbaikan catatan',
      'typo',
      'contributor',
    );

    expect(suggestion).toMatchObject({
      status: 'pending',
      wordLemma: 'kete',
      reviewedBy: null,
    });

    const [word] = await db.select().from(words).where(eq(words.id, WORD));
    expect(word.notes).toBe('lama');
    expect(word.isVerified).toBe(true);

    const [row] = await db
      .select()
      .from(wordEditSuggestions)
      .where(eq(wordEditSuggestions.id, suggestion.id));
    expect(row.status).toBe('pending');
  });

  it('reviewer → status approved, changes diterapkan + kata tetap verified', async () => {
    const suggestion = await repo.createSuggestion(
      REVIEWER,
      WORD,
      { notes: 'baru dari reviewer' },
      'Perbaikan catatan',
      'typo',
      'reviewer',
    );

    expect(suggestion).toMatchObject({
      status: 'approved',
      wordLemma: 'kete',
      reviewedBy: REVIEWER,
    });

    const [word] = await db.select().from(words).where(eq(words.id, WORD));
    expect(word.notes).toBe('baru dari reviewer');
    expect(word.isVerified).toBe(true);
    expect(word.verifiedBy).toBe(REVIEWER);

    const [row] = await db
      .select()
      .from(wordEditSuggestions)
      .where(eq(wordEditSuggestions.id, suggestion.id));
    expect(row.status).toBe('approved');
    expect(row.reviewedBy).toBe(REVIEWER);
  });

  it('reviewer pada kata belum verified → approved + is_verified true', async () => {
    await db
      .update(words)
      .set({ isVerified: false, verifiedBy: null, verifiedAt: null })
      .where(eq(words.id, WORD));

    const suggestion = await repo.createSuggestion(
      REVIEWER,
      WORD,
      { notes: 'langsung verify' },
      'Perbaikan',
      'typo',
      'reviewer',
    );

    expect(suggestion.status).toBe('approved');

    const [word] = await db.select().from(words).where(eq(words.id, WORD));
    expect(word.notes).toBe('langsung verify');
    expect(word.isVerified).toBe(true);
    expect(word.verifiedBy).toBe(REVIEWER);
  });
});

describe.skipIf(!hasTestDb)('WordSuggestionRepositoryImpl kategori', () => {
  const db = hasTestDb ? getTestDb() : null!;
  const repo = new WordSuggestionRepositoryImpl(noopPublic, noopImage);
  const MEANING = ulid26('01TESTMEANING');
  const OTHER_WORD = ulid26('01TESTWORDLAIN');

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(users).values([
      { id: OWNER, username: 'owner', email: 'owner@test.com', passwordHash: 'x', role: 'contributor' },
      { id: KONTRIBUTOR, username: 'kontributor', email: 'kon@test.com', passwordHash: 'x', role: 'contributor' },
      { id: REVIEWER, username: 'reviewer', email: 'rev@test.com', passwordHash: 'x', role: 'reviewer' },
    ]);
    await db.insert(languages).values({ id: SMB, code: 'smb', name: 'Sambas' });
    await db.insert(words).values([
      { id: WORD, languageId: SMB, lemma: 'kete', notes: 'lama', status: 'published', isVerified: false, createdBy: OWNER },
      { id: OTHER_WORD, languageId: SMB, lemma: 'lain', status: 'published', isVerified: true, createdBy: OWNER },
    ]);
    await db.insert(meanings).values({ id: MEANING, wordId: WORD, definition: 'definisi lama' });
  });

  it('tolak ubah lemma tidak mengembalikan definisi dari ubah makna yang tayang bersamaan', async () => {
    const lemmaSug = await repo.createSuggestion(KONTRIBUTOR, WORD, { lemma: 'kete2' }, 'x', 'lemma_notes', 'contributor');
    await repo.createSuggestion(
      KONTRIBUTOR,
      WORD,
      { meanings: [{ action: 'update', meaningId: MEANING, definition: 'definisi baru' }] },
      'x',
      'change_meaning',
      'contributor',
    );
    // Verifikasi dari jalur lain selagi usulan masih pending.
    await db.update(words).set({ isVerified: true }).where(eq(words.id, WORD));

    await repo.rejectSuggestion(lemmaSug.id, REVIEWER, 'bukan ejaan yang benar');

    const [word] = await db.select().from(words).where(eq(words.id, WORD));
    const [meaning] = await db.select().from(meanings).where(eq(meanings.id, MEANING));
    expect(word.lemma).toBe('kete');
    expect(word.isVerified).toBe(true);
    expect(meaning.definition).toBe('definisi baru');
  });

  it('kategori sama masih pending ditolak, kategori lain boleh', async () => {
    const changeMeaning = {
      meanings: [{ action: 'update' as const, meaningId: MEANING, definition: 'definisi baru' }],
    };
    await repo.createSuggestion(KONTRIBUTOR, WORD, changeMeaning, 'x', 'change_meaning', 'contributor');
    await expect(
      repo.createSuggestion(KONTRIBUTOR, WORD, changeMeaning, 'x', 'change_meaning', 'contributor'),
    ).rejects.toMatchObject({ errorCode: 'SUGGESTION_ALREADY_PENDING' });
    await expect(
      repo.createSuggestion(KONTRIBUTOR, WORD, { notes: 'baru' }, 'x', 'lemma_notes', 'contributor'),
    ).resolves.toMatchObject({ status: 'pending' });
  });

  it('sinonim kontributor pada kata belum terverifikasi tidak tayang sebelum disetujui', async () => {
    await repo.createSuggestion(
      KONTRIBUTOR,
      WORD,
      { relations: [{ action: 'add', relationType: 'synonym', wordId: OTHER_WORD }] },
      'x',
      'synonym',
      'contributor',
    );
    const rows = await db.select().from(lexicalRelations).where(eq(lexicalRelations.sourceWordId, WORD));
    expect(rows).toHaveLength(0);
  });

  it('image_id yang bukan milik kata ditolak 409', async () => {
    await expect(
      repo.createSuggestion(
        KONTRIBUTOR,
        WORD,
        { images: [{ action: 'remove', imageId: ulid26('01TESTNOIMAGE') }] },
        'x',
        'change_photo',
        'contributor',
      ),
    ).rejects.toMatchObject({ errorCode: 'SUGGESTION_STALE_DATA', statusCode: 409 });
  });

  it('ubah makna yang isinya sama ditolak', async () => {
    await expect(
      repo.createSuggestion(
        KONTRIBUTOR,
        WORD,
        { meanings: [{ action: 'update', meaningId: MEANING, definition: 'definisi lama' }] },
        'x',
        'change_meaning',
        'contributor',
      ),
    ).rejects.toMatchObject({ errorCode: 'SUGGESTION_NO_CHANGES' });
  });

  it('feed: usulan tayang muncul (aksi + lemma), antrean tidak, kata berlabel kasar disembunyikan', async () => {
    const feed = new ActivityRepositoryImpl(db);
    await repo.createSuggestion(KONTRIBUTOR, WORD, { notes: 'catatan kasar sekali' }, 'x', 'lemma_notes', 'contributor');
    await repo.createSuggestion(
      KONTRIBUTOR,
      WORD,
      { relations: [{ action: 'add', relationType: 'synonym', wordId: OTHER_WORD }] },
      'x',
      'synonym',
      'contributor',
    );

    const items = await feed.listRecentAppliedSuggestions(10);
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe('Mengusulkan perubahan · kete');

    await db.update(words).set({ usageLabels: ['kasar'] }).where(eq(words.id, WORD));
    expect(await feed.listRecentAppliedSuggestions(10)).toHaveLength(0);
  });
});
