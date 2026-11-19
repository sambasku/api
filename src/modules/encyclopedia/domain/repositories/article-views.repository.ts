export interface ArticleViewReport {
  trend: Array<{ day: string; total: number }>;
  items: Array<{
    articleId: string;
    name: string;
    slug: string;
    categoryName: string | null;
    views: number;
    lastViewed: string | null;
  }>;
}

export interface ArticleViewsRepository {
  recordViewBySlug(slug: string, viewerKey: string): Promise<void>;
  viewTotals(days: number | null): Promise<Map<string, number>>;
  viewReport(days: number): Promise<ArticleViewReport>;
}