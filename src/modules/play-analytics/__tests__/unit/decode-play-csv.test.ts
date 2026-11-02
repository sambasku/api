import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePlayCsvBytes } from '../../infrastructure/gcs-http';
import { parsePlayStatsCsv } from '../../domain/play-csv';
import { totalsFromRows } from '../../infrastructure/play-stats.provider';

/**
 * Bentuk file nyata Play Console export (diverifikasi dari
 * gs://pubsite_prod_6550329741832248261/stats/installs/..._202610_overview.csv):
 * gzip + UTF-16LE + BOM, header "Package Name" kapital, kolom "Update events".
 */
const HEADER =
  'Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Daily Device Upgrades,Total User Installs,Daily User Installs,Daily User Uninstalls,Active Device Installs,Install events,Update events,Uninstall events';
const ROWS = [
  '2026-10-01,com.iamutaki.sambasku,1,0,0,0,1,0,21,1,8,0',
  '2026-10-02,com.iamutaki.sambasku,1,0,0,0,1,0,24,1,4,0',
];
const RATINGS_HEADER = 'Date,Package Name,Daily Average Rating,Total Average Rating';
const RATINGS_ROWS = ['2026-10-15,com.iamutaki.sambasku,5.0,5.0', '2026-10-16,com.iamutaki.sambasku,4.0,4.5'];

function gzipUtf16(csv: string): Uint8Array<ArrayBuffer> {
  const utf16 = new Uint8Array(2 + csv.length * 2);
  utf16[0] = 0xff;
  utf16[1] = 0xfe;
  for (let i = 0; i < csv.length; i += 1) {
    const code = csv.charCodeAt(i);
    utf16[2 + i * 2] = code & 0xff;
    utf16[3 + i * 2] = code >> 8;
  }
  return new Uint8Array(gzipSync(utf16));
}

describe('decodePlayCsvBytes', () => {
  it('gzip + UTF-16LE + BOM -> teks CSV utuh', async () => {
    const csv = `${HEADER}\n${ROWS.join('\n')}\n`;
    const text = await decodePlayCsvBytes(gzipUtf16(csv));
    expect(text).toBe(csv);
  });

  it('UTF-16LE tanpa gzip tetap ter-decode', async () => {
    const csv = `${RATINGS_HEADER}\n${RATINGS_ROWS.join('\n')}`;
    const raw = new Uint8Array(2 + csv.length * 2);
    raw[0] = 0xff;
    raw[1] = 0xfe;
    for (let i = 0; i < csv.length; i += 1) {
      raw[2 + i * 2] = csv.charCodeAt(i) & 0xff;
      raw[3 + i * 2] = csv.charCodeAt(i) >> 8;
    }
    expect(await decodePlayCsvBytes(raw)).toBe(csv);
  });

  it('UTF-8 biasa (tanpa BOM) tetap jalan', async () => {
    const csv = `${HEADER}\n${ROWS[0]}`;
    const bytes = new TextEncoder().encode(csv);
    expect(await decodePlayCsvBytes(bytes)).toBe(csv);
  });
});

describe('parsePlayStatsCsv pada bentuk export nyata', () => {
  it('baris terparse dengan kolom "Update events" + header tidak bocor', () => {
    const rows = parsePlayStatsCsv(`${HEADER}\n${ROWS.join('\n')}`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-10-01', dailyInstalls: 1, updates: 8, activeInstalls: 21 });
  });

  it('header "Package name" lowercase tetap terparse', () => {
    const csv = 'Date,Package name,Daily Device Installs,Daily Device Uninstalls,Active Device Installs,Update events\n2026-10-01,com.x,5,1,100,2';
    expect(parsePlayStatsCsv(csv)[0]).toMatchObject({ dailyInstalls: 5, updates: 2 });
  });

  it('ratings "Daily Average Rating" terbaca', () => {
    const rows = parsePlayStatsCsv(`${RATINGS_HEADER}\n${RATINGS_ROWS.join('\n')}`);
    expect(rows[1]).toMatchObject({ averageRating: 4, totalAverageRating: 4.5 });
  });

  it('baris header tidak dihitung sebagai data', () => {
    const rows = parsePlayStatsCsv(`${HEADER}\n`);
    expect(rows).toEqual([]);
    expect(totalsFromRows(rows).newInstalls).toBe(0);
  });
});
