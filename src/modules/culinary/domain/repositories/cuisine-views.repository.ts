export interface CuisineViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    cuisineId: string;
    name: string;
    slug: string;
    categoryName: string | null;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface CuisineViewsRepository {
  recordViewBySlug(slug: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<CuisineViewReport>;
}