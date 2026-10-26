// Entitas domain - murni TypeScript, tidak tahu Drizzle/HTTP
// (03-api-kontribusi-verifikasi.md - pencarian kosong jadi peluang kontribusi)
// + 14-api: isVisible gate beranda

export type SearchMissDirection = 'lemma' | 'translation';

export interface SearchMiss {
  id: string;
  term: string;
  direction: SearchMissDirection;
  hitCount: number;
  lastSearchedAt: Date;
  /**
   * DERIVED (tidak disimpan): true kalau sudah ada kata published yang
   * menjawab term - lemma match (direction lemma) atau translation text
   * match (direction translation). Lihat 12-api §4.
   */
isFulfilled: boolean;
/**
* DERIVED (tidak disimpan): jumlah kontribusi usulan kata baru yang masih
* menunggu review dan menaut miss ini (contributions.search_miss_id,
* status pending). Supaya verifikator tidak buat kata dobel dari miss
* yang usulannya sudah masuk antrean. Hanya diisi scope admin.
*/
pendingContributionCount: number;
/** DERIVED: id usulan pending tertua (link antrean review). Null = tidak ada. */
pendingContributionId: string | null;
/** Gate beranda (14-api). Default false untuk miss baru. */
isVisible: boolean;
createdAt: Date;
}
