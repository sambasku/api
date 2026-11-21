/** Laporan view usaha untuk Console. */
export interface UsahaViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    usahaId: string;
    name: string;
    slug: string;
    categoryName: string | null;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface UsahaViewsRepository {
  recordViewBySlug(slug: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<UsahaViewReport>;
}