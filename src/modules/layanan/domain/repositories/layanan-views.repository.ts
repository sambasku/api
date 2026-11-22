/** Laporan view layanan publik untuk Console. */
export interface LayananViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    layananId: string;
    name: string;
    slug: string;
    category: string;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface LayananViewsRepository {
  recordViewBySlug(slug: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<LayananViewReport>;
}