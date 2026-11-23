/** Laporan view karya untuk Console. */
export interface KaryaViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    karyaId: string;
    title: string;
    slug: string;
    kind: string;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface KaryaViewsRepository {
  recordViewBySlug(slug: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<KaryaViewReport>;
}