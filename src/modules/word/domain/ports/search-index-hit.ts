/** Satu hasil index pencarian: word id + skor relevansi (makin kecil makin relevan, konvensi bm25). */
export interface SearchIndexHit {
  wordId: string;
  /** bm25: makin kecil = makin relevan (FTS5 ORDER BY rank asc). */
  rank: number;
}
