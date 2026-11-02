import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { getTestClient } from '@/shared/database/drizzle/test-client';

const { parsed } = config({ path: '.env.test', quiet: true });
const hasTestDb = !!parsed?.DATABASE_URL;

/**
 * 0083 rows-read: EXPLAIN QUERY PLAN untuk hot path publik. Regression
 * guard - kalau index ekspresi ter-drop / query berubah sampai kembali
 * SCAN / TEMP B-TREE, test ini merah sebelum meter Turso ikut merah.
 */
describe.skipIf(!hasTestDb)('Query plan hemat rows read (0083)', () => {
  const client = getTestClient();

  async function plan(sql: string, args: (string | number)[] = []): Promise<string> {
    const rs = await client.execute(`EXPLAIN QUERY PLAN ${sql}`, args);
    return rs.rows
      .map((r) => {
        const row = r as Record<string, unknown>;
        return String(row.detail ?? '');
      })
      .join('\n');
  }

  it('listAtoZ + letter panel: SEARCH words_status_az_idx, tanpa SCAN words / TEMP B-TREE', async () => {
    const p = await plan(
      `select id from words
       where deleted_at is null and status = 'published'
         and lower(lemma) like ? || '%'
       order by lower(lemma), id
       limit 21`,
      ['a'],
    );
    expect(p).toContain('words_status_az_idx');
    expect(p).not.toContain('SCAN words');
    expect(p).not.toContain('TEMP B-TREE');
  });

  it('listLatest feed beranda: SEARCH words_published_approved_idx, tanpa TEMP B-TREE', async () => {
    const p = await plan(
      `select id from words
       where deleted_at is null and status = 'published'
         and (coalesce(verified_at, created_at), id) < (?, ?)
       order by coalesce(verified_at, created_at) desc, id desc
       limit 21`,
      [1800000000, '01AAAAAAAAAAAAAAAAAAAAAAAA'],
    );
    expect(p).toContain('words_published_approved_idx');
    expect(p).not.toContain('SCAN words');
    expect(p).not.toContain('TEMP B-TREE');
  });

  it('fulfilled lemma search-miss: lower(lemma) kena index, tanpa SCAN words', async () => {
    const p = await plan(
      `select 1 from words w
       where lower(w.lemma) = ? and w.status = 'published' and w.deleted_at is null`,
      ['apam'],
    );
    expect(p).not.toContain('SCAN words');
    expect(p).not.toContain('SCAN w');
  });

  it('fulfilled variants: lower(trim(form)) kena word_variants_form_trim_idx', async () => {
    const p = await plan(
      `select 1 from word_variants v
       where lower(trim(v.form)) = ? and v.deleted_at is null`,
      ['memakan'],
    );
    expect(p).toContain('word_variants_form_trim_idx');
    expect(p).not.toContain('SCAN v');
  });

  it('fulfilled translations: kena meaning_translations_text_trim_idx', async () => {
    const p = await plan(
      `select 1 from meaning_translations mt
       where lower(trim(mt.translation_text)) = ? and mt.deleted_at is null`,
      ['makan'],
    );
    expect(p).toContain('meaning_translations_text_trim_idx');
    expect(p).not.toContain('SCAN mt');
  });

  it('deck vote: total dari meaning_vote_counts join, bukan correlated scan votes', async () => {
    // Bentuk query listDeckMeanings (0101): LEFT JOIN ringkasan + NOT EXISTS vote/skip.
    const p = await plan(
      `select meanings.id, coalesce(meaning_vote_counts.total, 0)
       from meanings
       inner join words on words.id = meanings.word_id
       left join meaning_vote_counts on meaning_vote_counts.meaning_id = meanings.id
       where meanings.deleted_at is null and meanings.status = 'published'
         and words.deleted_at is null and words.status = 'published'
         and not exists (
           select 1 from votes
           where votes.user_id = ? and votes.entity_type = 'meaning' and votes.entity_id = meanings.id
         )
       order by coalesce(meaning_vote_counts.total, 0) asc, meanings.id asc
       limit 11`,
      ['01UAAAAAAAAAAAAAAAAAAAAAAA'],
    );
    // COUNT(*) correlated dulu: "SCALAR SUBQUERY" baca votes per baris makna.
    // Sekarang votes hanya muncul sebagai NOT EXISTS (covering unique index).
    expect(p).not.toMatch(/SUBQUERY.*\n.*SCAN votes/);
    expect(p).toContain('meaning_vote_counts');
  });
});
