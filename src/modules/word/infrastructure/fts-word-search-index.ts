import type { Client } from '@libsql/client';
import type { WordSearchIndex } from '../domain/ports/word-search-index';
import type { SearchIndexHit } from '../domain/ports/search-index-hit';

/**
 * Adapter FTS5 trigram (words_search_fts) untuk WordSearchIndex.
 * Table diisi trigger di migration 0069 - adapter ini read-only.
 *
 * Satu kata bisa punya banyak baris index (lemma + N variasi + N terjemahan),
 * jadi dedupe per word_id (rank terbaik = bm25 paling negatif) lewat window
 * function. bm25() hanya valid di scope query FTS langsung - makanya
 * row_number dulu, baru limit/offset.
 *
 * ponytail: trigram butuh >= 3 karakter per term; term pendek dilewati
 * (repo LIKE fallback menangani). Kalau nanti perlu typo/fuzzy, ganti
 * adapter ke Elasticsearch/Meilisearch - port tidak berubah.
 */
export class FtsWordSearchIndex implements WordSearchIndex {
  constructor(private readonly client: Client) {}

  async search(terms: string[], limit: number, offset = 0): Promise<SearchIndexHit[]> {
    const usable = terms.filter((t) => t.length >= 3);
    if (usable.length === 0) return [];
    // Term dikutip ganda supaya token trigram dipakai literal (bukan
    // dipecah ulang). Kutip dihapus - term sudah token bersih.
    const match = usable.map((t) => `"${t.replaceAll('"', '')}"`).join(' OR ');
    const rs = await this.client.execute({
      sql: `SELECT word_id, rank FROM (
              SELECT word_id, rank, row_number() OVER (PARTITION BY word_id ORDER BY rank) rn
              FROM (
                SELECT word_id, bm25(words_search_fts) AS rank
                FROM words_search_fts WHERE words_search_fts MATCH ?
                ORDER BY rank
              )
            ) WHERE rn = 1 ORDER BY rank LIMIT ? OFFSET ?`,
      args: [match, limit, offset],
    });
    return rs.rows.map((row) => ({
      wordId: String(row.word_id),
      rank: Number(row.rank),
    }));
  }
}
