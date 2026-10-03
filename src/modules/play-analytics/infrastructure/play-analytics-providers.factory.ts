import type { PlayStatsProvider } from '../application/ports/play-analytics.port';
import { FakePlayStatsProvider } from './fake-play-stats.provider';
import { GcsPlayStatsProvider } from './play-stats.provider';

export interface PlayAnalyticsEnv {
  NODE_ENV: string;
  WEB_ANALYTICS_FAKE: boolean;
  GOOGLE_ANALYTICS_SA_EMAIL?: string;
  GOOGLE_ANALYTICS_SA_PRIVATE_KEY?: string;
  /** Nama bucket GCS export Play Console, mis: pubsrc_my_pkg. */
  PLAY_STATS_GCS_BUCKET?: string;
  /** Prefix object di bucket. Kosong = baca semua (filter by nama file). */
  PLAY_STATS_GCS_PREFIX?: string;
}

/**
 * Play Console export berbagi service account dengan GA4/GSC. Env kosong =
 * provider `not_configured` (UI tampilkan "belum terhubung"), API tetap jalan.
 */
export function createPlayAnalyticsProviders(env: PlayAnalyticsEnv): {
  play: PlayStatsProvider;
} {
  if (env.WEB_ANALYTICS_FAKE && env.NODE_ENV !== 'production') {
    return { play: new FakePlayStatsProvider() };
  }
  const clientEmail = env.GOOGLE_ANALYTICS_SA_EMAIL?.trim();
  const privateKey = env.GOOGLE_ANALYTICS_SA_PRIVATE_KEY?.trim();
  const account = clientEmail && privateKey ? { clientEmail, privateKey } : null;
  return {
    play: new GcsPlayStatsProvider({
      account,
      bucket: env.PLAY_STATS_GCS_BUCKET?.trim() || null,
      // ponytail: prefix kosong = list seluruh bucket lalu filter nama file
      // installs_*/ratings_* - struktur folder export Play bisa berubah.
      prefix: env.PLAY_STATS_GCS_PREFIX?.trim() || '',
    }),
  };
}
