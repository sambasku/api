import type { WordStatus } from '../domain/entities/word.entity';
import { meaningDeduplicationFingerprint } from './utils/meaning-deduplication';

export interface ImportMeaningInput {
  translation?: string;
  definition?: string;
  example?: string;
  /** Kode kelas kata CSV: kb(kb), kk(verba), ks(adjektiva), kt(adverbia), kd(preposisi). Kosong=default umum. */
  wordClassCode?: string;
  /** Terjemahan kalimat contoh (Indonesian). */
  exampleTranslation?: string;
}

export interface ImportWordInput {
  lemma: string;
  /** Tayangkan. Bukan tanda terverifikasi. */
  verify: boolean;
  /** Hanya berlaku bersama tayang dan role verifikator. */
  verified: boolean;
  notes?: string;
  meanings: ImportMeaningInput[];
}

export type ImportOutcome = 'created' | 'meanings_added' | 'skipped' | 'invalid';

export interface ImportWordResult {
  lemma: string;
  outcome: ImportOutcome;
  status?: 'draft' | 'published';
  is_verified?: boolean;
  meanings_added: number;
  meanings_skipped: number;
  message?: string;
  word_id?: string;
}

const VERIFIER_ROLES = new Set(['admin', 'root', 'reviewer']);

/** Multi role: terima satu role atau array (interseksi). */
export function canVerifyImport(role: string | string[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => VERIFIER_ROLES.has(r));
}

/**
 * Sidik makna untuk skip duplikat impor.
 * Satu aturan dengan create/edit: normalizeMeaningText + placeholder-aware
 * lewat meaningDeduplicationFingerprint (bukan trim+lower kasar).
 */
export function meaningFingerprint(input: {
  definition?: string;
  translation?: string;
  isHaveDefinition?: boolean;
  isHaveTranslation?: boolean;
}): string {
  const hasDef = input.isHaveDefinition ?? !!input.definition?.trim();
  const hasTr = input.isHaveTranslation ?? !!input.translation?.trim();
  return meaningDeduplicationFingerprint({
    definition: input.definition ?? '',
    translation: input.translation ?? '',
    isHaveDefinition: hasDef,
    isHaveTranslation: hasTr,
  });
}

export function normalizeLemma(lemma: string): string {
  return lemma.trim().toLowerCase();
}

/**
 * Tayangkan + role verifikator → tayang, belum tentu terverifikasi.
 * Terverifikasi hanya ikut kalau tayang juga dicentang.
 * Selain itu draf. Makna pada induk yang belum tayang selalu draf.
 */
export function decideImportPublication(input: {
  verify: boolean;
  verified: boolean;
  role?: string | string[];
  roles?: string[];
  parentStatus: WordStatus | null;
}): { status: 'draft' | 'published'; isVerified: boolean; forcedDraft: boolean } {
  const role = input.roles ?? input.role ?? [];
  const parentBlocks =
    input.parentStatus !== null && input.parentStatus !== 'published';
  if (parentBlocks || !input.verify || !canVerifyImport(role)) {
    return { status: 'draft', isVerified: false, forcedDraft: parentBlocks };
  }
  return { status: 'published', isVerified: input.verified, forcedDraft: false };
}

export function preparedMeaning(input: ImportMeaningInput): {
  definition: string;
  translation: string;
  example: string;
  isHaveDefinition: boolean;
  isHaveTranslation: boolean;
  /** Normalized lowercase kode kelas kata CSV (kb/kk/ks/kt/kd) atau undefined. */
  wordClassCode?: string;
  /** Trimmed Indonesian translation of example sentence. */
  exampleTranslation?: string;
} | null {
  const translation = input.translation?.trim() ?? '';
  const definition = input.definition?.trim() ?? '';
  const example = input.example?.trim() ?? '';
  if (!translation && !definition) return null;
  const rawCode = input.wordClassCode?.trim().toLowerCase();
  return {
    definition: definition || '-',
    translation,
    example,
    isHaveDefinition: definition.length > 0,
    isHaveTranslation: translation.length > 0,
    wordClassCode: rawCode || undefined,
    exampleTranslation: input.exampleTranslation?.trim() || undefined,
  };
}
