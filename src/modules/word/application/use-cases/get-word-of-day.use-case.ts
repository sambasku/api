import type { WordDetail } from '../../domain/entities/word.entity';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import { hasFeedExcludedUsageLabels } from '@/shared/constants/usage-labels';

export interface WordOfDayResult {
  /** 'YYYY-MM-DD' WIB yang dipakai seed pemilihan kata */
  date: string;
  /** verified_at dalam 7 hari terakhir (proxy waktu terbit, backlog WOTD keputusan 5) */
  isNewThisWeek: boolean;
  /** null = korpus published kosong / kata terpilih ternyata tak terbaca */
  word: WordDetail | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, UTC+7 tanpa DST

/** Key app_settings penyimpan pilihan harian (rows-read: 1 baris, bukan 45k). */
export function wordOfDaySettingKey(date: string): string {
  return `word_of_the_day:${date}`;
}

/** 'YYYY-MM-DD' di zona WIB - satu tanggal untuk semua user Indonesia. */
export function wibDateString(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 28-api-word-of-the-day.md: kata hari ini, deterministik per tanggal WIB
 * (repo ORDER BY md5(id || ':' || date)). Hasil di-cache in-memory per
 * tanggal - invalid otomatis saat tanggal berganti; per-isolate di Workers
 * aman karena pemilihan deterministik, cache hanya performa.
 *
 * Persist harian (rows-read Turso): algoritma lama membaca SEMUA id
 * published (45k baris) lalu hash di app - per isolate dingin per hari.
 * Sekarang pilihan disimpan ke `app_settings` (read 1 baris); miss →
 * algoritma lama jalan lalu disimpan onConflictDoNothing (race antar
 * isolate tidak menggandakan baris). Selection algorithm TIDAK berubah:
 * kata terpilih per hari identik.
 *
 * Re-validasi label feed-excluded pada hit cache: admin bisa mengubah
 * usage_labels mid-day tanpa restart isolate.
 */
export class GetWordOfDayUseCase {
  private cache: { date: string; result: WordOfDayResult } | null = null;

  constructor(
    private readonly wordRepo: WordRepository,
    private readonly settingsRepo: AppSettingsRepository | null = null,
  ) {}

  async execute(now: Date = new Date()): Promise<WordOfDayResult> {
    const date = wibDateString(now);
    if (this.cache?.date === date) {
      const cached = this.cache.result;
      if (!cached.word || !hasFeedExcludedUsageLabels(cached.word.usageLabels)) {
        return cached;
      }
      this.cache = null;
    }

    const id = await this.resolveWordOfDayId(date);
    // Race jarang: kata ter-unpublish di antara dua query → detail null →
    // hari itu dianggap kosong. Diterima (kata terganti besok).
    let word = id ? await this.wordRepo.findDetailById(id) : null;
    if (word && hasFeedExcludedUsageLabels(word.usageLabels)) {
      word = null;
    }
    const isNewThisWeek = Boolean(
      word?.verifiedAt && now.getTime() - word.verifiedAt.getTime() <= SEVEN_DAYS_MS,
    );

    const result: WordOfDayResult = { date, isNewThisWeek, word };
    this.cache = { date, result };
    return result;
  }

  /** app_settings 1-baris kalau ada; fallback algoritma hash lama + simpan. */
  private async resolveWordOfDayId(date: string): Promise<string | null> {
    const key = wordOfDaySettingKey(date);
    if (this.settingsRepo) {
      try {
        const saved = await this.settingsRepo.getValue(key);
        if (saved) return saved;
      } catch {
        // Store gagal (transien) → jalur lama tetap benar, jangan gagalkan.
      }
    }
    const id = await this.wordRepo.findWordOfDayId(date);
    if (id && this.settingsRepo) {
      try {
        await this.settingsRepo.setIfAbsent(key, id, {
          type: 'string',
          description: 'Pilihan kata hari ini (WIB)',
        });
      } catch {
        // Gagal simpan bukan error user - isolate lain akan menulis.
      }
    }
    return id;
  }
}
