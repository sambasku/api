/**
 * Kontrak GET /api/v1/admin/mobile-analytics/:section. API sudah menormalisasi
 * data GA4 mobile ke bentuk ini; console memakai bentuk wire (snake_case)
 * apa adanya tanpa mapper.
 */

export const MOBILE_ANALYTICS_SECTIONS = ['overview', 'events', 'screens', 'audience'] as const;
export type MobileAnalyticsSection = (typeof MOBILE_ANALYTICS_SECTIONS)[number];

export const SECTION_LABELS: Record<MobileAnalyticsSection, string> = {
  overview: 'Ikhtisar',
  events: 'Event',
  screens: 'Layar',
  audience: 'Audiens',
};

export const RANGE_PRESETS = ['7d', '28d', '90d', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface RangeQuery {
  range: RangePreset;
  start?: string;
  end?: string;
}

export interface DateRangeWire {
  start: string;
  end: string;
}

export type ProviderStatus = 'ok' | 'empty' | 'not_configured' | 'error';

export interface ProviderResult<T = unknown> {
  status: ProviderStatus;
  errorCode: string | null;
  message: string | null;
  range: DateRangeWire | null;
  data: T | null;
}

export type MobileProviderResult<T = unknown> = ProviderResult<T>;

export interface MobileAnalyticsReport {
  section: MobileAnalyticsSection;
  range: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    days: number;
  };
  mobile: MobileProviderResult;
}

export interface MobileTotals {
  active_users: number;
  total_users: number;
  new_users: number;
  sessions: number;
  event_count: number;
  engagement_rate: number;
}

export interface MobileTrendPoint {
  date: string;
  active_users: number;
  sessions: number;
  event_count: number;
}

export interface ScreenRow {
  name: string;
  views: number;
  users: number;
}

export interface EventRow {
  name: string;
  count: number;
  users: number;
}

export interface PlatformRow {
  platform: 'android' | 'ios';
  users: number;
  sessions: number;
  share: number;
}

export interface AppVersionRow {
  version: string;
  users: number;
  sessions: number;
  share: number;
}

export interface CountryRow {
  country: string;
  users: number;
  sessions: number;
  share: number;
}

export interface MobileOverview {
  totals: MobileTotals;
  previous: MobileTotals;
  trend: MobileTrendPoint[];
  top_events: EventRow[];
  top_screens: ScreenRow[];
}

export interface MobileEvents {
  totals: MobileTotals;
  previous: MobileTotals;
  trend: MobileTrendPoint[];
  events: EventRow[];
}

export interface MobileScreens {
  totals: MobileTotals;
  previous: MobileTotals;
  trend: MobileTrendPoint[];
  screens: ScreenRow[];
}

export interface MobileAudience {
  totals: MobileTotals;
  previous: MobileTotals;
  trend: MobileTrendPoint[];
  platforms: PlatformRow[];
  app_versions: AppVersionRow[];
  countries: CountryRow[];
}

export interface SectionReport<M = never> {
  section: MobileAnalyticsSection;
  range: {
    start: string;
    end: string;
    previous_start: string;
    previous_end: string;
    days: number;
  };
  mobile: ProviderResult<M>;
}

export interface SectionReportMap {
  overview: SectionReport<MobileOverview>;
  events: SectionReport<MobileEvents>;
  screens: SectionReport<MobileScreens>;
  audience: SectionReport<MobileAudience>;
}