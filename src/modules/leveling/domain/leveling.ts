/**
 * Leveling derived: poin dihitung ulang dari karya, bukan kolom tersimpan.
 * Spek: docs/LEVELING_AND_STREAK_IMPLEMENT.md
 */

export const POINT_WEIGHTS = {
  word: 15,
  meaning: 6,
  example: 5,
  pronunciation: 5,
  word_image: 4,
  word_audio: 4,
  verification: 6,
  place: 20,
  usaha: 25,
  cuisine: 20,
  event: 15,
  pantun: 3,
  data_edit: 3,
  /** Upvote diterima atas karya milik user (bukan vote yang diberikan). */
  vote_received: 1,
} as const;

/** Bobot impor massal (words.import_session_id terisi). */
export const IMPORT_POINT_FACTOR = 0.5;

/**
 * Pengali kelangkaan dari jumlah lemma per `words.language_id`.
 * Diterapkan setelah impor 50%; domain non-kata tetap 1.0.
 */
export const SCARCITY_WORD_COUNT_RARE = 100;
export const SCARCITY_WORD_COUNT_UNCOMMON = 500;
export const SCARCITY_MULT_RARE = 1.5;
export const SCARCITY_MULT_UNCOMMON = 1.25;
export const SCARCITY_MULT_COMMON = 1.0;

export const LEVEL_THRESHOLDS = [
  0, 20, 80, 200, 600, 1400, 2800, 5000, 8000, 12000, 18000, 27000, 40000, 60000,
  90000,
] as const;

export const TITLE_CODES = [
  'peninjau',
  'pencatat',
  'penyumbang',
  'pengumpul',
  'penggiat',
  'penjaga-jejak',
  'penghubung',
  'pewaris',
  'penjaga-warisan',
  'sesepuh',
  'tetua',
  'pengayom',
  'pelestari',
  'empu',
  'legenda',
] as const;

export type TitleCode = (typeof TITLE_CODES)[number];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export type ContributionEntityTypeForPoints =
  | 'word'
  | 'meaning'
  | 'example'
  | 'pronunciation'
  | 'word_image'
  | 'word_audio';

/** Pengali kelangkaan dari jumlah kata published/ada di bahasa itu. */
export function scarcityMultiplier(languageWordCount: number): number {
  const n = Number.isFinite(languageWordCount) ? languageWordCount : Number.POSITIVE_INFINITY;
  if (n < SCARCITY_WORD_COUNT_RARE) return SCARCITY_MULT_RARE;
  if (n < SCARCITY_WORD_COUNT_UNCOMMON) return SCARCITY_MULT_UNCOMMON;
  return SCARCITY_MULT_COMMON;
}

/**
 * Poin satu baris kontribusi kata (status sudah dijamin approved/corrected).
 * Urutan: base → impor 50% → × kelangkaan. Orphan (word hilang) = 0 di SQL.
 */
export function pointsForContributionEntity(
  entityType: ContributionEntityTypeForPoints,
  imported: boolean,
  languageWordCount: number = Number.POSITIVE_INFINITY,
): number {
  const base = POINT_WEIGHTS[entityType];
  const afterImport = imported ? base * IMPORT_POINT_FACTOR : base;
  return afterImport * scarcityMultiplier(languageWordCount);
}

export function pointsForVerification(): number {
  return POINT_WEIGHTS.verification;
}

export function pointsForVoteReceived(upvotes: number): number {
  return Math.max(0, Math.floor(upvotes)) * POINT_WEIGHTS.vote_received;
}

/** Level 1..15 dari total poin (floor ke pita terakhir yang tercapai). */
export function levelForPoints(points: number): number {
  const p = Number.isFinite(points) ? Math.max(0, points) : 0;
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (p >= LEVEL_THRESHOLDS[i]!) level = i + 1;
    else break;
  }
  return level;
}

/** Ambang level berikutnya, atau null di Level 15. */
export function nextLevelPoints(points: number): number | null {
  const level = levelForPoints(points);
  if (level >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[level]!;
}

export function titleCodeForLevel(level: number): TitleCode {
  const idx = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) - 1;
  return TITLE_CODES[idx]!;
}

export interface LevelingWire {
  points: number;
  level: number;
  nextLevelPoints: number | null;
  titleCode: TitleCode;
  exploration: number;
  accuracy: number;
  depth: number;
  streakDays: number;
}

export interface LevelingScoreInput {
  /** Poin sudah termasuk impor, kelangkaan, vote_received, verifikasi non-self. */
  points: number;
  exploration: number;
  accuracy: number;
  depth: number;
  streakDays?: number;
}

export function buildLeveling(input: LevelingScoreInput): LevelingWire {
  const points = Math.max(0, Math.floor(input.points));
  const level = levelForPoints(points);
  return {
    points,
    level,
    nextLevelPoints: nextLevelPoints(points),
    titleCode: titleCodeForLevel(level),
    exploration: Math.max(0, Math.floor(input.exploration)),
    accuracy: Math.max(0, Math.floor(input.accuracy)),
    depth: Math.max(0, Math.floor(input.depth)),
    streakDays: Math.max(0, Math.floor(input.streakDays ?? 0)),
  };
}

/** Wire snake_case untuk response JSON. */
export function levelingToWire(l: LevelingWire) {
  return {
    points: l.points,
    level: l.level,
    next_level_points: l.nextLevelPoints,
    title_code: l.titleCode,
    exploration: l.exploration,
    accuracy: l.accuracy,
    depth: l.depth,
    streak_days: l.streakDays,
  };
}
