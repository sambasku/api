// Entitas domain - murni TypeScript, tidak tahu Drizzle/HTTP


export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'corrected';
export type ChangeAction = 'update' | 'add' | 'delete';
export type RelationAction = 'add' | 'remove';
export type VariantAction = 'add' | 'remove';
export type ImageAction = 'add' | 'remove' | 'set_primary';
export type GroupAction = 'add' | 'remove';
// PRD relasi-lemma: variant_of (variasi bentuk) + nonstandard_of (bentuk
// tidak baku terverifikasi) ikut bisa diusulkan komunitas.
export type RelationType =
  | 'synonym'
  | 'antonym'
  | 'has_component'
  | 'derived_from'
  | 'variant_of'
  | 'nonstandard_of';

/** Kategori usulan: bentuk proposed_changes dikunci per kategori. */
export const SUGGESTION_CATEGORY_CODES = [
  'change_meaning',
  'change_word_class',
  'add_meaning',
  'add_photo',
  'change_photo',
  'synonym',
  'antonym',
  'variant_of',
  'nonstandard_of',
  'derived_from',
  'meaning_group',
  'spelling_variant',
  'lemma_notes',
] as const;

export type SuggestionCategoryCode = (typeof SUGGESTION_CATEGORY_CODES)[number];

/** Kode alasan lama: payload boleh campuran, tanpa aturan bentuk. */
export const LEGACY_REASON_CODES = [
  'typo',
  'inaccurate_definition',
  'missing_example',
  'missing_relation',
  'image_issue',
  'other',
] as const;

export type SuggestionReasonCode =
  | SuggestionCategoryCode
  | (typeof LEGACY_REASON_CODES)[number];

export const SUGGESTION_REASON_CODES = [
  ...SUGGESTION_CATEGORY_CODES,
  ...LEGACY_REASON_CODES,
] as const;

const CATEGORY_SET = new Set<string>(SUGGESTION_CATEGORY_CODES);

export function isSuggestionCategory(code: string): code is SuggestionCategoryCode {
  return CATEGORY_SET.has(code);
}

export const REASON_CODE_LABELS: Record<SuggestionReasonCode, string> = {
  change_meaning: 'Ubah makna',
  change_word_class: 'Ubah kelas kata',
  add_meaning: 'Tambah makna',
  add_photo: 'Tambah foto',
  change_photo: 'Ubah foto',
  synonym: 'Sinonim',
  antonym: 'Antonim',
  variant_of: 'Variasi bentuk',
  nonstandard_of: 'Bentuk tidak baku',
  derived_from: 'Kata turunan',
  meaning_group: 'Kelompok makna',
  spelling_variant: 'Variasi penulisan',
  lemma_notes: 'Lemma atau catatan',
  typo: 'Kesalahan penulisan',
  inaccurate_definition: 'Definisi kurang tepat',
  missing_example: 'Kurang contoh',
  missing_relation: 'Relasi/sinonim kurang',
  image_issue: 'Gambar kurang/salah',
  other: 'Lainnya',
};

/** Compose teks tampilan kolom `reason` dari code + optional detail. */
export function composeReasonDisplay(
  code: SuggestionReasonCode,
  text?: string | null,
): string {
  const label = REASON_CODE_LABELS[code];
  const detail = text?.trim();
  if (!detail) return label;
  return `${label}: ${detail}`;
}

export interface WordEditSuggestion {
  id: string;
  userId: string;
  wordId: string;
  proposedChanges: ProposedChanges;
  reason: string;
  reasonCode: SuggestionReasonCode;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  contributorUsername?: string | null;
  contributorDisplayName?: string | null;
  wordLemma?: string;
}

export type SuggestionWordType = 'word' | 'idiom' | 'peribahasa' | 'ungkapan';

export interface ProposedChanges {
  /** Jenis entri. Bukan kelas kata (itu di makna). */
  wordType?: SuggestionWordType;
  lemma?: string;
  notes?: string;
  meanings?: MeaningChange[];
  categoryIdsToAdd?: string[];
  categoryIdsToRemove?: string[];
  relations?: RelationChange[];
  variants?: VariantChange[];
  images?: ImageChange[];
  /** PRD relasi-lemma: usulan keanggotaan kelompok makna. */
  groups?: GroupChange[];
}

export interface MeaningChange {
  meaningId?: string;
  action: ChangeAction;
  wordClassId?: string;
  definition?: string;
  translations?: TranslationChange[];
}

export interface TranslationChange {
  languageId: string;
  translationText: string;
  translationType?: string;
}

export interface RelationChange {
  action: RelationAction;
  relationType: RelationType;
  wordId: string;
}

export interface VariantChange {
  action: VariantAction;
  form: string;
  variantType?: string;
  dialectId?: string | null;
}

/**
 * PRD relasi-lemma: usulan kelompok makna. `groupId` = kelompok yang sudah
 * ada; `name` + `wordIds` = usul kelompok baru (anggota lain selain kata ini).
 */
export interface GroupChange {
  action: GroupAction;
  groupId?: string;
  /** Hanya untuk action=add tanpa groupId (kelompok baru). */
  name?: string;
  description?: string | null;
  wordIds?: string[];
}

export interface ImageChange {
  action: ImageAction;
  imageId?: string;
  url?: string;
  /** Stock Media Explorer; absen → storage aktif saat apply */
  provider?: string;
  providerFileId?: string;
  altText?: string;
  isPrimary?: boolean;
}

export interface SuggestionSummary {
  id: string;
  wordId: string;
  wordLemma: string;
  contributorId: string;
  contributorUsername: string | null;
  contributorDisplayName: string | null;
  reason: string;
  reasonCode: SuggestionReasonCode;
  status: SuggestionStatus;
  createdAt: Date;
  summaryChanges: {
    lemma: string | null;
    notes: string | null;
    wordType: string | null;
    meaningsCount: number;
    categoriesAdded: number;
    categoriesRemoved: number;
  relationsCount: number;
  variantsCount: number;
  imagesCount: number;
  groupsCount: number;
};
}

export interface SuggestionDetail {
  suggestion: WordEditSuggestion;
  currentWord: CurrentWordSnapshot;
  diff: DiffResult;
}

export interface CurrentWordSnapshot {
  lemma: string;
  notes: string | null;
  wordType: string;
  meanings: CurrentMeaningSnapshot[];
  categoryIds: string[];
  relations: { relationType: string; wordId: string; lemma: string }[];
  variants: { form: string; variantType: string; dialectId: string | null }[];
  images: { id: string; url: string; isPrimary: boolean; altText: string | null }[];
  /** PRD relasi-lemma: kelompok makna published yang memuat kata ini. */
  groups: { groupId: string; name: string; memberWordIds: string[] }[];
}

export interface CurrentMeaningSnapshot {
  id: string;
  wordClass: { code: string; name: string };
  /** Id kelas saat ini. Tidak dikirim ke klien. */
  wordClassId: string | null;
  definition: string;
  translations: { translationText: string }[];
}

export interface DiffResult {
  lemma: DiffField;
  notes: DiffField;
  wordType: DiffField;
  meanings: DiffMeaning[];
  categories: { added: string[]; removed: string[] };
  relations: {
    added: { relationType: string; wordId: string; lemma?: string }[];
    removed: { relationType: string; wordId: string; lemma?: string }[];
  };
  variants: {
    added: { form: string; variantType: string }[];
    removed: { form: string; variantType: string }[];
  };
  groups: {
    joined: { groupId: string; name: string }[];
    left: { groupId: string; name: string }[];
    created: { name: string; memberLemmas: string[] }[];
  };
  images: {
    added: {
      url: string;
      isPrimary: boolean;
      provider?: string | null;
      providerFileId?: string | null;
    }[];
    removed: { imageId: string }[];
    setPrimary: { imageId: string }[];
  };
}

export interface DiffField {
  /** Nama field bila satu objek diff memuat lebih dari satu kolom (mis. kelas kata). */
  label?: string;
  current: string | null;
  proposed: string | null;
  changed: boolean;
}

export interface DiffMeaning {
  meaningId: string | null;
  changes: DiffField[];
}
