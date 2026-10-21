import { and, gte, lt, sql, type SQL } from 'drizzle-orm';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import type { AchievementCriteria } from './entities/achievement.entity';

/**
 * Registry source achievement - SATU-SATUNYA tempat sumber kriteria
 * didaftarkan.
 *
 * Prinsip: kriteria adalah DATA, bukan kode bebas. Admin memilih `source`
 * dari daftar di sini; backend tidak pernah menerima nama kolom atau
 * ekspresi SQL dari input admin. Menambah jenis achievement baru (mis.
 * kelak kuis) = menambah satu handler di registry + satu baris katalog -
 * evaluator, tabel, API, console, dan mobile tidak berubah.
 *
 * Kontrak handler:
 * - `buildMatch(criteria)` mengembalikan ekspresi SQL boolean pada tabel
 *   `users` (kondisi baris). Bentuk seragam ini membuat evaluator cukup
 *   satu anti-join tanpa cabang per source.
 * - Window waktu memakai kolom waktu milik source itu sendiri (untuk
 *   `registration` = `users.created_at`).
 */
export interface AchievementFilterField {
  key: string;
  label: string;
  /** Opsi tertutup (dipakai admin console sebagai dropdown). */
  options?: string[];
}

export interface AchievementSourceDefinition {
  source: string;
  /** Label Indonesia untuk dropdown admin console. */
  label: string;
  description: string;
  /** Sumber ini punya ambang jumlah (agregat). */
  supportsThreshold: boolean;
  /** Sumber ini punya rentang waktu. */
  supportsWindow: boolean;
  /** Filter opsional yang didukung sumber ini. */
  filterFields: AchievementFilterField[];
  /**
   * True = tidak pernah discan (cuma grant manual admin), mis. event
   * khusus yang tidak punya criteria komputabel.
   */
  manualOnly?: boolean;
  /** Ekspresi SQL boolean: user memenuhi kriteria source ini. */
  buildMatch(criteria: AchievementCriteria): SQL;
}

/** Parse window ISO 8601 ke Date; throw bila bukan tanggal valid. */
function parseWindowBound(value: string, field: 'from' | 'to'): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Window ${field} bukan tanggal valid: ${value}`);
  }
  return parsed;
}

/**
 * Source `registration` - user terdaftar dalam rentang waktu tertentu.
 * Basis data: `users.created_at`. Excluded menyeluruh (diterapkan
 * evaluator): akun anonim, akun non-aktif, akun soft-deleted.
 */
const registrationSource: AchievementSourceDefinition = {
  source: 'registration',
  label: 'Kohort pendaftaran',
  description: 'Pengguna yang terdaftar dalam rentang tanggal tertentu.',
  supportsThreshold: false,
  supportsWindow: true,
  filterFields: [],
  buildMatch(criteria: AchievementCriteria): SQL {
    const from = criteria.window?.from;
    const to = criteria.window?.to;
    if (!from || !to) {
      // Tanpa window = seluruh pengguna terdaftar (kohort tak terbatas).
      return sql`1 = 1`;
    }
    const fromDate = parseWindowBound(from, 'from');
    const toDate = parseWindowBound(to, 'to');
    // gte/lt (bukan sql template) supaya binding Date ikut tipe kolom
    // timestamp - libsql menyimpan created_at sebagai unix seconds.
    return and(gte(users.createdAt, fromDate), lt(users.createdAt, toDate))!;
  },
};

/**
 * Source `manual` - pemberian admin, tanpa komputasi. Tidak pernah discan;
 * hanya bisa diberikan lewat grant manual (kategori event khusus).
 */
const manualSource: AchievementSourceDefinition = {
  source: 'manual',
  label: 'Manual (admin)',
  description: 'Diberikan langsung oleh admin, tanpa kondisi otomatis.',
  supportsThreshold: false,
  supportsWindow: false,
  filterFields: [],
  manualOnly: true,
  buildMatch(): SQL {
    // Tidak pernah cocok - sumber manual tidak pernah discan.
    return sql`1 = 0`;
  },
};

/**
 * Registry aktif. Kunci = `criteria.source` yang valid.
 *
 * Menambah source baru (mis. `quizzes_completed` saat fitur kuis hidup):
 * 1. Tulis handler di file ini (buildMatch + label + filter fields).
 * 2. Tambah baris di `docs/ACHIEVEMENT.md` (registry sumber).
 * 3. Selesai - tidak ada perubahan tabel, evaluator, API, console, mobile.
 */
export const ACHIEVEMENT_SOURCE_REGISTRY: Record<string, AchievementSourceDefinition> = {
  registration: registrationSource,
  manual: manualSource,
};

/** Seluruh source terdaftar (untuk dropdown admin console). */
export const ACHIEVEMENT_SELECTABLE_SOURCES: AchievementSourceDefinition[] =
  Object.values(ACHIEVEMENT_SOURCE_REGISTRY);

export function findAchievementSource(source: string): AchievementSourceDefinition | null {
  return ACHIEVEMENT_SOURCE_REGISTRY[source] ?? null;
}

export function isAchievementSourceKnown(source: string): boolean {
  return source in ACHIEVEMENT_SOURCE_REGISTRY;
}
