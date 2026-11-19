/** Laporan view lemma untuk Console `/words/views` (G6). */
export interface WordViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    wordId: string;
    lemma: string;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface WordViewsRepository {
  /** Catat 1 view by word id. Id tidak valid / bukan published = no-op. */
  recordViewById(wordId: string, viewerKey: string): Promise<void>;
  /** Catat 1 view by lemma (URL web). Lemma tidak ketemu / draft = no-op. */
  recordViewByLemma(lemma: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<WordViewReport>;
}
