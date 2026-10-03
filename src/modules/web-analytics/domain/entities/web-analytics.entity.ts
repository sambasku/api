/**
 * Bentuk ternormalisasi data trafik web. Provider (GA4, Search Console,
 * fake, nanti internal) wajib memetakan respons vendor ke sini, supaya
 * struktur Google tidak bocor ke controller/console.
 */

export const WEB_ANALYTICS_SECTIONS = ['overview', 'visitors', 'behavior', 'search', 'sources'] as const;
export type WebAnalyticsSection = (typeof WEB_ANALYTICS_SECTIONS)[number];

export interface DateRange {
  /** YYYY-MM-DD, inklusif. */
  start: string;
  end: string;
}

export interface ResolvedRange {
  current: DateRange;
  previous: DateRange;
  days: number;
}

export interface Ga4Totals {
  activeUsers: number;
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  eventCount: number;
  engagementRate: number;
}

export interface Ga4TrendPoint {
  date: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
}

export interface PageRow {
  path: string;
  views: number;
  users: number;
}

export interface LandingPageRow {
  path: string;
  sessions: number;
  engagementRate: number;
}

export interface EventRow {
  name: string;
  count: number;
  users: number;
}

export interface BreakdownRow {
  key: string;
  users: number;
  sessions: number;
}

export type TrafficChannel = 'organic_search' | 'direct' | 'social' | 'referral' | 'other';

export interface ChannelRow {
  channel: TrafficChannel;
  sessions: number;
  share: number;
}

export interface Ga4Overview {
  totals: Ga4Totals;
  previous: Ga4Totals;
  trend: Ga4TrendPoint[];
  topPages: PageRow[];
}

export interface Ga4Visitors {
  totals: Ga4Totals;
  previous: Ga4Totals;
  trend: Ga4TrendPoint[];
  devices: BreakdownRow[];
  countries: BreakdownRow[];
}

export interface Ga4Behavior {
  totals: Ga4Totals;
  previous: Ga4Totals;
  topPages: PageRow[];
  landingPages: LandingPageRow[];
  events: EventRow[];
}

export interface Ga4Sources {
  totalSessions: number;
  channels: ChannelRow[];
}

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Rasio 0..1. */
  ctr: number;
  position: number;
}

export interface SearchTrendPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchOverview {
  totals: SearchTotals;
  previous: SearchTotals;
  trend: SearchTrendPoint[];
  topQueries: QueryRow[];
}

export interface SearchDetail extends SearchOverview {
  topPages: SearchPageRow[];
}

export interface SearchFilters {
  page?: string;
  query?: string;
}

export type ProviderStatus = 'ok' | 'empty' | 'not_configured' | 'error';

export interface ProviderResult<T = unknown> {
  status: ProviderStatus;
  errorCode: string | null;
  message: string | null;
  range: DateRange | null;
  data: T | null;
}

export interface WebAnalyticsReport {
  section: WebAnalyticsSection;
  range: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    days: number;
  };
  ga4?: ProviderResult;
  searchConsole?: ProviderResult;
}
