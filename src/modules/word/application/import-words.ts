import type { WordStatus } from '../domain/entities/word.entity';

export interface ImportMeaningInput {
  translation?: string;
  definition?: string;
  example?: string;
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

/** Sidik makna: definisi dan padanan yang memang diisi, huruf kecil. */
export function meaningFingerprint(input: {
  definition?: string;
  translation?: string;
  isHaveDefinition?: boolean;
  isHaveTranslation?: boolean;
}): string {
  const hasDef = input.isHaveDefinition ?? !!input.definition?.trim();
  const hasTr = input.isHaveTranslation ?? !!input.translation?.trim();
  const definition = hasDef ? (input.definition ?? '').trim().toLowerCase() : '';
  const translation = hasTr ? (input.translation ?? '').trim().toLowerCase() : '';
  return `${definition}\n${translation}`;
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
} | null {
  const translation = input.translation?.trim() ?? '';
  const definition = input.definition?.trim() ?? '';
  const example = input.example?.trim() ?? '';
  if (!translation && !definition) return null;
  return {
    definition: definition || '-',
    translation,
    example,
    isHaveDefinition: definition.length > 0,
    isHaveTranslation: translation.length > 0,
  };
}
