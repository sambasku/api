import type { MobileAnalyticsProvider } from '../application/ports/mobile-analytics.port';
import { addDays } from '@/modules/web-analytics/domain/date-range';
import type { DateRange, ResolvedRange } from '@/modules/web-analytics/domain/entities/web-analytics.entity';
import type {
  MobileOverview,
  MobileEvents,
  MobileScreens,
  MobileAudience,
  MobileTotals,
  MobileTrendPoint,
  ScreenRow,
  EventRow,
  PlatformRow,
  AppVersionRow,
  CountryRow,
} from '../domain/entities/mobile-analytics.entity';

function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

function wave(date: string, base: number): number {
  const day = Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  return Math.max(0, Math.round(base * (1 + 0.3 * Math.sin((day * 2 * Math.PI) / 7) + (day % 97) / 300)));
}

function trend(range: DateRange): MobileTrendPoint[] {
  return eachDay(range).map((date) => {
    const base = 300;
    return { date, active_users: wave(date, base), sessions: wave(date, base * 1.8), event_count: wave(date, base * 3.2) };
  });
}

const SCREENS: ScreenRow[] = [
  { name: 'Beranda', views: 8420, users: 2100 },
  { name: 'Kamus', views: 5930, users: 1480 },
  { name: 'Peta', views: 3840, users: 950 },
  { name: 'Suara', views: 2780, users: 680 },
  { name: 'Kontribusi', views: 1860, users: 420 },
];

const EVENTS: EventRow[] = [
  { name: 'screen_view', count: 18890, users: 3620 },
  { name: 'word_open', count: 11200, users: 1850 },
  { name: 'search_submit', count: 5400, users: 980 },
  { name: 'audio_play', count: 4300, users: 760 },
  { name: 'vote_cast', count: 2100, users: 540 },
  { name: 'contribute_submit', count: 1680, users: 390 },
  { name: 'bookmark_toggle', count: 1540, users: 360 },
  { name: 'share_complete', count: 980, users: 260 },
];

const PLATFORMS: PlatformRow[] = [
  { platform: 'android', users: 3620, sessions: 6500, share: 0.82 },
  { platform: 'ios', users: 780, sessions: 1380, share: 0.18 },
];

const APP_VERSIONS: AppVersionRow[] = [
  { version: '2.9.1', users: 2100, sessions: 3800, share: 0.47 },
  { version: '2.8.3', users: 1860, sessions: 3340, share: 0.42 },
  { version: '2.7.0', users: 440, sessions: 800, share: 0.11 },
];

const COUNTRIES: CountryRow[] = [
  { country: 'Indonesia', users: 4400, sessions: 7880, share: 1.0 },
];

const TOTALS: MobileTotals = {
  active_users: 4400,
  total_users: 12000,
  new_users: 1800,
  sessions: 13880,
  event_count: 48990,
  // Fraksi 0-1, sama seperti respons asli GA4 (bukan persen).
  engagement_rate: 0.353,
};

export class FakeMobileAnalyticsProvider implements MobileAnalyticsProvider {
  isConfigured(): boolean {
    return true;
  }

  async getOverview(range: ResolvedRange): Promise<MobileOverview> {
    return {
      totals: TOTALS,
      previous: { ...TOTALS, active_users: 4100, sessions: 12900, event_count: 44890, new_users: 1650 },
      trend: trend(range.current),
      top_events: EVENTS.slice(0, 5),
      top_screens: SCREENS,
    };
  }

  async getEvents(range: ResolvedRange): Promise<MobileEvents> {
    return {
      totals: TOTALS,
      previous: TOTALS,
      trend: trend(range.current),
      events: EVENTS,
    };
  }

  async getScreens(range: ResolvedRange): Promise<MobileScreens> {
    return {
      totals: TOTALS,
      previous: TOTALS,
      trend: trend(range.current),
      screens: SCREENS,
    };
  }

  async getAudience(range: ResolvedRange): Promise<MobileAudience> {
    return {
      totals: TOTALS,
      previous: TOTALS,
      trend: trend(range.current),
      platforms: PLATFORMS,
      app_versions: APP_VERSIONS,
    countries: COUNTRIES,
  };
  }
}
