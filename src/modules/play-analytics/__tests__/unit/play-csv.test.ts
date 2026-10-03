import { describe, expect, it } from 'vitest';
import { isOverviewCsv, isRelevantPlayCsv, normalizePlayDate, parsePlayStatsCsv, playCsvMonth } from '../../domain/play-csv';
import { countriesFromRows, totalsFromRows, trendFromRows } from '../../infrastructure/play-stats.provider';

const INSTALLS_CSV = `Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Active Device Installs,Update/Upgrade Installs
20261001,id.sambasku.app,20,3,4200,7
20261002,id.sambasku.app,25,4,4221,9`;

const RATINGS_CSV = `Date,Package Name,Average Rating,Total Average Rating,Rating Count,Total Rating Count
20261001,id.sambasku.app,4.2,4.36,10,128
20261002,id.sambasku.app,4.5,4.36,12,140`;

const COUNTRY_CSV = `Date,Package Name,Country,Daily Device Installs
20261001,id.sambasku.app,ID,18
20261001,id.sambasku.app,MY,1
20261002,id.sambasku.app,ID,22
20261002,id.sambasku.app,MY,2`;

describe('normalizePlayDate', () => {
  it('YYYYMMDD -> YYYY-MM-DD', () => {
    expect(normalizePlayDate('20261001')).toBe('2026-10-01');
  });

  it('nilai aneh diteruskan', () => {
    expect(normalizePlayDate('2026-10-01')).toBe('2026-10-01');
  });
});

describe('parsePlayStatsCsv', () => {
  it('parse file installs', () => {
    const rows = parsePlayStatsCsv(INSTALLS_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: '2026-10-01',
      dailyInstalls: 20,
      dailyUninstalls: 3,
      activeInstalls: 4200,
      updates: 7,
      averageRating: null,
    });
  });

  it('parse file ratings (kolom opsional)', () => {
    const rows = parsePlayStatsCsv(RATINGS_CSV);
    expect(rows[1]).toMatchObject({ averageRating: 4.5, totalAverageRating: 4.36, ratingCount: 12, totalRatingCount: 140 });
  });

  it('CSV kosong / header saja -> []', () => {
    expect(parsePlayStatsCsv('')).toEqual([]);
    expect(parsePlayStatsCsv('Date,Package Name\n')).toEqual([]);
  });
});

describe('nama file', () => {
  it('relevan = installs/ratings csv', () => {
    expect(isRelevantPlayCsv('stats/installs/installs_pkg_202610_overview.csv')).toBe(true);
    expect(isRelevantPlayCsv('stats/ratings/ratings_pkg_202610_country.csv')).toBe(true);
    expect(isRelevantPlayCsv('stats/crash/crash_pkg_202610_overview.csv')).toBe(false);
  });

  it('bulan dari nama file', () => {
    expect(playCsvMonth('installs_pkg_202610_overview.csv')).toBe('202610');
    expect(playCsvMonth('aneh.csv')).toBeNull();
  });

  it('overview vs country', () => {
    expect(isOverviewCsv('installs_pkg_202610_overview.csv')).toBe(true);
    expect(isOverviewCsv('installs_pkg_202610_country.csv')).toBe(false);
  });
});

describe('agregasi', () => {
  const rows = parsePlayStatsCsv(INSTALLS_CSV);
  const range = { start: '2026-10-01', end: '2026-10-02' };

  it('totals: sum harian + snapshot terakhir', () => {
    const t = totalsFromRows(rows);
    expect(t.newInstalls).toBe(45);
    expect(t.uninstalls).toBe(7);
    expect(t.activeInstalls).toBe(4221);
    expect(t.updates).toBe(16);
  });

  it('trend mengisi hari kosong dengan 0', () => {
    const trend = trendFromRows(rows, { start: '2026-10-01', end: '2026-10-04' });
    expect(trend).toHaveLength(4);
    expect(trend[2]).toEqual({ date: '2026-10-03', installs: 0, uninstalls: 0 });
    expect(trend[3]).toEqual({ date: '2026-10-04', installs: 0, uninstalls: 0 });
  });

  it('countries: snapshot hari terakhir dalam rentang', () => {
    const cRows = parsePlayStatsCsv(COUNTRY_CSV);
    const countries = countriesFromRows(cRows, range);
    expect(countries[0]).toEqual({ country: 'ID', installs: 22 });
    expect(countries[1]).toEqual({ country: 'MY', installs: 2 });
  });
});
