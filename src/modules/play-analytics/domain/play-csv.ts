/**
 * Parser CSV export statistik Play Console dari Google Cloud Storage.
 *
 * Play menulis file per-bulan, mis:
 *   installs_<pkg>_202610_overview.csv       (ringkasan per hari)
 *   installs_<pkg>_202610_country.csv        (per negara, kumulatif bulan)
 *   ratings_<pkg>_202610_overview.csv        (rating per hari)
 *   ratings_<pkg>_202610_country.csv
 *
 * Kolom dipakai (nama header EN, stabil bertahun-tahun):
 *   Date, Package Name, Daily Device Installs, Daily Device Uninstalls,
 *   Active Device Installs, Update/Upgrade Installs, Average Rating,
 *   Total Average Rating, Rating Count, Total Rating Count, Country
 */

export interface PlayCsvRow {
  date: string; // YYYY-MM-DD (dari YYYYMMDD)
  country: string; // kode negara, '' utk file overview
  dailyInstalls: number;
  dailyUninstalls: number;
  activeInstalls: number;
  updates: number;
  /** Rata-rata rating hari itu, null kalau kolom tidak ada (file installs). */
  averageRating: number | null;
  /** Rata-rata rating kumulatif seluruh waktu. */
  totalAverageRating: number | null;
  ratingCount: number;
  totalRatingCount: number;
}

const num = (v: string | undefined): number => {
  if (!v) return 0;
  const n = Number(v.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

/** YYYYMMDD -> YYYY-MM-DD; nilai aneh diteruskan apa adanya. */
export function normalizePlayDate(v: string): string {
  const t = v.trim();
  return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const idx = headers.indexOf(cand);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Kolom opsional: -1 artinya tidak tersedia di file itu. */
export function parsePlayStatsCsv(csv: string): PlayCsvRow[] {
  const text = csv.replace(/\r\n?/g, '\n');
  const lines = text.split('\n').filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim());
  const iDate = findCol(headers, ['Date']);
  const iCountry = findCol(headers, ['Country']);
  const iInst = findCol(headers, ['Daily Device Installs', 'Daily New Installs']);
  const iUninst = findCol(headers, ['Daily Device Uninstalls']);
  const iActive = findCol(headers, ['Active Device Installs']);
  const iUpdates = findCol(headers, ['Update/Upgrade Installs']);
  const iAvg = findCol(headers, ['Average Rating']);
  const iTotAvg = findCol(headers, ['Total Average Rating']);
  const iCount = findCol(headers, ['Rating Count']);
  const iTotCount = findCol(headers, ['Total Rating Count']);
  if (iDate < 0) return [];

  const rows: PlayCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const date = normalizePlayDate(cells[iDate] ?? '');
    if (!date) continue;
    rows.push({
      date,
      country: iCountry >= 0 ? (cells[iCountry] ?? '').trim() : '',
      dailyInstalls: iInst >= 0 ? num(cells[iInst]) : 0,
      dailyUninstalls: iUninst >= 0 ? num(cells[iUninst]) : 0,
      activeInstalls: iActive >= 0 ? num(cells[iActive]) : 0,
      updates: iUpdates >= 0 ? num(cells[iUpdates]) : 0,
      averageRating: iAvg >= 0 ? num(cells[iAvg]) : null,
      totalAverageRating: iTotAvg >= 0 ? num(cells[iTotAvg]) : null,
      ratingCount: iCount >= 0 ? num(cells[iCount]) : 0,
      totalRatingCount: iTotCount >= 0 ? num(cells[iTotCount]) : 0,
    });
  }
  return rows;
}

/** Nama file export Play yang relevan: installs_*.csv | ratings_*.csv. */
export function isRelevantPlayCsv(objectName: string): boolean {
  const base = objectName.split('/').pop() ?? objectName;
  return /^(installs|ratings)_.*\.csv$/.test(base);
}

/** Ambil tahun-bulan (YYYYMM) dari nama file: installs_pkg_202610_overview.csv. */
export function playCsvMonth(objectName: string): string | null {
  const m = /_(\d{6})_/.exec(objectName.split('/').pop() ?? '');
  return m ? m[1]! : null;
}

/** File overview (bukan per-country): ..._overview.csv. */
export function isOverviewCsv(objectName: string): boolean {
  const base = objectName.split('/').pop() ?? objectName;
  return /_overview\.csv$/.test(base);
}
