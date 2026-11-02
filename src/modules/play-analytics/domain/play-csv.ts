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

/** Null kalau sel kosong (beda dari `num` yang menganggap kosong = 0). */
const numOrNull = (v: string | undefined): number | null => (v && v.trim() ? num(v) : null);

/** YYYYMMDD -> YYYY-MM-DD; nilai aneh diteruskan apa adanya. */
export function normalizePlayDate(v: string): string {
  const t = v.trim();
  return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function findCol(headers: string[], candidates: string[]): number {
  // Case-insensitive: Google kapitalisasi header tidak konsisten antar file
  // ("Package Name" vs "Package name", "Daily Average Rating").
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
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
const iUpdates = findCol(headers, ['Update events', 'Daily Device Upgrades', 'Update/Upgrade Installs']);
const iAvg = findCol(headers, ['Average Rating', 'Daily Average Rating']);
const iTotAvg = findCol(headers, ['Total Average Rating']);
const iCount = findCol(headers, ['Rating Count', 'Daily Rating Count']);
const iTotCount = findCol(headers, ['Total Rating Count']);
if (iDate < 0) return [];

const rows: PlayCsvRow[] = [];
for (const line of lines.slice(1)) {
  const cells = line.split(',');
  const date = normalizePlayDate(cells[iDate] ?? '');
  // Header tidak ikut jadi baris data ("Date" bukan tanggal).
  if (!YMD.test(date)) continue;
    rows.push({
      date,
      country: iCountry >= 0 ? (cells[iCountry] ?? '').trim() : '',
      dailyInstalls: iInst >= 0 ? num(cells[iInst]) : 0,
      dailyUninstalls: iUninst >= 0 ? num(cells[iUninst]) : 0,
      activeInstalls: iActive >= 0 ? num(cells[iActive]) : 0,
      updates: iUpdates >= 0 ? num(cells[iUpdates]) : 0,
    averageRating: iAvg >= 0 ? numOrNull(cells[iAvg]) : null,
    totalAverageRating: iTotAvg >= 0 ? numOrNull(cells[iTotAvg]) : null,
    ratingCount: iCount >= 0 ? num(cells[iCount]) : 0,
    totalRatingCount: iTotCount >= 0 ? num(cells[iTotCount]) : 0,
    });
  }
  return rows;
}

/**
 * Nama file export Play yang relevan: hanya `*_overview.csv` dan
 * `*_country.csv`. Varian lain (`app_version`, `carrier`, `device`,
 * `language`, `os_version`) tidak dipakai agregator, jadi jangan diunduh -
 * satu request = satu Worker invocation, unduhan per file dihitung
 * subrequest.
 */
export function isRelevantPlayCsv(objectName: string): boolean {
  const base = objectName.split('/').pop() ?? objectName;
  return /^(installs|ratings)_.*_(overview|country)\.csv$/.test(base);
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
