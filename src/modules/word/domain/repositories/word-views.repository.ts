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

/** Tren harian satu lemma (Console detail kata). */
export interface WordViewSeries {
  total: number;
  lastViewed: string | null;
  trend: Array<{ day: string; total: number }>;
}

export interface WordViewsRepository {
  /** Catat 1 view by word id. Id tidak valid / bukan published = no-op. */
  recordViewById(wordId: string, viewerKey: string): Promise<void>;
  /** Catat 1 view by lemma (URL web). Lemma tidak ketemu / draft = no-op. */
  recordViewByLemma(lemma: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<WordViewReport>;
  /** Tren pembaca unik per hari untuk satu word_id. */
  viewSeriesForWord(wordId: string, days: number): Promise<WordViewSeries>;
}
