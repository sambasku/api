import type { SearchIndexHit } from './search-index-hit';

/**
 * Port pencarian teks kata (hexagonal - api-base-stack.md Section 5).
 * Adapter FTS5 sekarang; Elasticsearch/Meilisearch nanti tanpa ubah use case.
 *
 * Kontrak minimal sengaja: cari kata yang cocok substring salah satu term,
 * kembalikan word id + skor. Filter status/label/halaman tetap di repo SQL -
 * index hanya kecocokan teks, bukan sumber kebenaran visibilitas.
 */
export interface WordSearchIndex {
  /**
   * Cari word id yang teksnya (lemma/variasi/terjemahan) cocok salah satu
   * term. Term dikutip + digabung OR; karakter FTS khusus sudah dibersihkan
   * caller sebelum masuk sini.
   * @param terms token query user (lowercase, unik, max 5)
   * @param limit banyaknya hit maksimal
   * @param offset lewati N hit pertama (pagination offset FTS)
   */
  search(terms: string[], limit: number, offset?: number): Promise<SearchIndexHit[]>;
}
