import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGoogleAccessTokenCache } from '@/shared/google/service-account-token';
import { AnalyticsProviderError } from '../../application/ports/analytics-provider.port';
import { resolveDateRange } from '../../domain/date-range';
import { channelBucket, Ga4Provider } from '../../infrastructure/ga4.provider';
import { SearchConsoleProvider } from '../../infrastructure/search-console.provider';

const RANGE = resolveDateRange({ range: '7d' }, new Date('2026-10-03T03:00:00Z'));
let privateKey = '';

beforeAll(async () => {
  // Key RSA asli supaya penandatanganan JWT Web Crypto benar-benar jalan.
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as { privateKey: CryptoKey };
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----`;
});

beforeEach(() => clearGoogleAccessTokenCache());
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Token endpoint selalu sukses; API Google dibalas `api`. */
function stubGoogle(api: (url: string, body: unknown) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'tok', expires_in: 3600 });
    return api(url, init?.body ? JSON.parse(String(init.body)) : undefined);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ga4 = () => new Ga4Provider({ account: { clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey }, propertyId: '123' });
const gsc = () =>
  new SearchConsoleProvider({ account: { clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey }, siteUrl: 'sc-domain:sambasku.com' });

describe('Ga4Provider', () => {
  it('tanpa kredensial / property → isConfigured false', () => {
    expect(new Ga4Provider({ account: null, propertyId: '1' }).isConfigured()).toBe(false);
    expect(new Ga4Provider({ account: { clientEmail: 'a', privateKey: 'b' }, propertyId: null }).isConfigured()).toBe(false);
  });

  it('overview: satu batchRunReports, totals per dateRange, trend YYYY-MM-DD terurut', async () => {
    const fetchMock = stubGoogle((url, body) => {
      expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports');
      expect((body as { requests: unknown[] }).requests).toHaveLength(3);
      return json({
        reports: [
          {
            dimensionHeaders: [{ name: 'dateRange' }],
            metricHeaders: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
            rows: [
              { dimensionValues: [{ value: 'previous' }], metricValues: [{ value: '80' }, { value: '100' }, { value: '300' }] },
              { dimensionValues: [{ value: 'current' }], metricValues: [{ value: '120' }, { value: '150' }, { value: '420' }] },
            ],
          },
          {
            dimensionHeaders: [{ name: 'date' }],
            metricHeaders: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
            rows: [
              { dimensionValues: [{ value: '20261002' }], metricValues: [{ value: '20' }, { value: '25' }, { value: '70' }] },
              { dimensionValues: [{ value: '20260926' }], metricValues: [{ value: '10' }, { value: '12' }, { value: '30' }] },
            ],
          },
          {
            dimensionHeaders: [{ name: 'pagePath' }],
            metricHeaders: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
            rows: [{ dimensionValues: [{ value: '/kamus' }], metricValues: [{ value: '2874' }, { value: '1982' }] }],
          },
        ],
      });
    });

    const data = await ga4().getOverview(RANGE);
    expect(data.totals).toMatchObject({ activeUsers: 120, sessions: 150, pageViews: 420 });
    expect(data.previous).toMatchObject({ activeUsers: 80, sessions: 100, pageViews: 300 });
    expect(data.trend.map((p) => p.date)).toEqual(['2026-09-26', '2026-10-02']);
    expect(data.topPages).toEqual([{ path: '/kamus', views: 2874, users: 1982 }]);
    // token + 1 batch
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('report tanpa rows → angka nol (bukan error)', async () => {
    stubGoogle(() => json({ reports: [{}, {}, {}, {}] }));
    const data = await ga4().getVisitors(RANGE);
    expect(data.totals.sessions).toBe(0);
    expect(data.trend).toEqual([]);
    expect(data.devices).toEqual([]);
  });

  it('sources: channel group dikelompokkan ke 5 bucket + share', async () => {
    stubGoogle(() =>
      json({
        reports: [
          {
            dimensionHeaders: [{ name: 'sessionDefaultChannelGroup' }],
            metricHeaders: [{ name: 'sessions' }],
            rows: [
              ['Organic Search', '50'],
              ['Direct', '25'],
              ['Organic Social', '10'],
              ['Paid Social', '5'],
              ['Referral', '5'],
              ['Unassigned', '5'],
            ].map(([g, s]) => ({ dimensionValues: [{ value: g }], metricValues: [{ value: s }] })),
          },
        ],
      }),
    );
    const data = await ga4().getSources(RANGE);
    expect(data.totalSessions).toBe(100);
    expect(data.channels).toEqual([
      { channel: 'organic_search', sessions: 50, share: 0.5 },
      { channel: 'direct', sessions: 25, share: 0.25 },
      { channel: 'social', sessions: 15, share: 0.15 },
      { channel: 'referral', sessions: 5, share: 0.05 },
      { channel: 'other', sessions: 5, share: 0.05 },
    ]);
    expect(channelBucket('Email')).toBe('other');
  });

  it.each([
    [403, 'permission_denied'],
    [401, 'permission_denied'],
    [429, 'rate_limited'],
    [503, 'upstream'],
  ] as const)('HTTP %i → %s', async (status, kind) => {
    stubGoogle(() => json({ error: { message: 'nope' } }, status));
    await expect(ga4().getOverview(RANGE)).rejects.toMatchObject({ kind });
  });

  it('fetch melempar (jaringan) → network', async () => {
    stubGoogle(() => {
      throw new TypeError('fetch failed');
    });
    await expect(ga4().getSources(RANGE)).rejects.toMatchObject({ kind: 'network' });
  });

  it('token ditolak (invalid_grant) → permission_denied', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, 400)),
    );
    const err = await ga4().getSources(RANGE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AnalyticsProviderError);
    expect((err as AnalyticsProviderError).kind).toBe('permission_denied');
  });
});

describe('SearchConsoleProvider', () => {
  it('search: query paralel, site di-encode, filter page diteruskan, ctr tetap rasio', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    stubGoogle((url, body) => {
      expect(url).toBe(
        'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Asambasku.com/searchAnalytics/query',
      );
      const b = body as Record<string, unknown> & { dimensions?: string[] };
      bodies.push(b);
      const dim = b.dimensions?.[0];
      if (!dim) return json({ rows: [{ clicks: 428, impressions: 8421, ctr: 0.0508, position: 4.2 }] });
      if (dim === 'date') {
        return json({
          rows: [
            { keys: ['2026-09-30'], clicks: 2, impressions: 40 },
            { keys: ['2026-09-24'], clicks: 1, impressions: 30 },
          ],
        });
      }
      return json({ rows: [{ keys: [dim === 'query' ? 'kamus sambas' : 'https://sambasku.com/'], clicks: 5, impressions: 50, ctr: 0.1, position: 3 }] });
    });

    const data = await gsc().getSearch(RANGE, { page: '/kata/' });
    expect(bodies).toHaveLength(5);
    expect(bodies[0]!.dimensionFilterGroups).toEqual([
      { filters: [{ dimension: 'page', operator: 'contains', expression: '/kata/' }] },
    ]);
    expect(data.totals).toEqual({ clicks: 428, impressions: 8421, ctr: 0.0508, position: 4.2 });
    expect(data.trend.map((p) => p.date)).toEqual(['2026-09-24', '2026-09-30']);
    expect(data.topQueries[0]!.query).toBe('kamus sambas');
    expect(data.topPages[0]!.page).toBe('https://sambasku.com/');
  });

  it('tanpa rows → totals nol', async () => {
    stubGoogle(() => json({}));
    const data = await gsc().getOverview(RANGE);
    expect(data.totals).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    expect(data.topQueries).toEqual([]);
  });

  it('403 → permission_denied', async () => {
    stubGoogle(() => json({ error: { code: 403 } }, 403));
    await expect(gsc().getOverview(RANGE)).rejects.toMatchObject({ kind: 'permission_denied' });
  });
});
