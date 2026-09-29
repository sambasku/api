import type {
  ProposedChanges,
  SuggestionReasonCode,
} from '../../domain/entities/word-suggestion.entity';
import { isSuggestionCategory } from '../../domain/entities/word-suggestion.entity';

export interface ShapeIssue {
  field: string;
  message: string;
}

type Part = 'lemma' | 'notes' | 'meanings' | 'categories' | 'relations' | 'variants' | 'images';

function presentParts(c: ProposedChanges): Set<Part> {
  const parts = new Set<Part>();
  if (c.lemma !== undefined) parts.add('lemma');
  if (c.notes !== undefined) parts.add('notes');
  if (c.meanings?.length) parts.add('meanings');
  if (c.categoryIdsToAdd?.length || c.categoryIdsToRemove?.length) parts.add('categories');
  if (c.relations?.length) parts.add('relations');
  if (c.variants?.length) parts.add('variants');
  if (c.images?.length) parts.add('images');
  return parts;
}

const ALLOWED: Record<string, Part[]> = {
  change_meaning: ['meanings'],
  change_word_class: ['meanings'],
  add_meaning: ['meanings'],
  add_photo: ['images'],
  change_photo: ['images'],
  synonym: ['relations'],
  antonym: ['relations'],
  spelling_variant: ['variants'],
  lemma_notes: ['lemma', 'notes'],
};

/**
 * Kategori mengunci isi proposed_changes. Kode alasan lama tidak dicek
 * (klien lama boleh kirim campuran). Koreksi verifikator tidak lewat sini.
 */
export function checkSuggestionCategoryShape(
  code: SuggestionReasonCode,
  c: ProposedChanges,
): ShapeIssue[] {
  if (!isSuggestionCategory(code)) return [];

  const issues: ShapeIssue[] = [];
  const allowed = new Set(ALLOWED[code]);
  const parts = presentParts(c);
  for (const part of parts) {
    if (!allowed.has(part)) {
      issues.push({ field: part, message: 'Bagian ini tidak sesuai kategori usulan yang dipilih' });
    }
  }
  if (![...allowed].some((p) => parts.has(p))) {
    issues.push({ field: 'proposed_changes', message: 'Isi perubahan untuk kategori ini belum ada' });
    return issues;
  }

  const meanings = c.meanings ?? [];
  const oneMeaning = () => {
    if (meanings.length !== 1) {
      issues.push({ field: 'meanings', message: 'Satu usulan hanya untuk satu makna' });
      return undefined;
    }
    return meanings[0];
  };

  switch (code) {
    case 'change_meaning': {
      const m = oneMeaning();
      if (!m) break;
      if (m.action !== 'update' || !m.meaningId) {
        issues.push({ field: 'meanings', message: 'Pilih makna yang ingin diubah' });
      }
      if (m.wordClassId !== undefined) {
        issues.push({ field: 'meanings.word_class_id', message: 'Kelas kata diubah lewat kategori Ubah kelas kata' });
      }
      if (m.definition === undefined && !m.translations?.length) {
        issues.push({ field: 'meanings', message: 'Isi definisi atau padanan yang baru' });
      }
      break;
    }
    case 'change_word_class': {
      const m = oneMeaning();
      if (!m) break;
      if (m.action !== 'update' || !m.meaningId) {
        issues.push({ field: 'meanings', message: 'Pilih makna yang ingin diubah' });
      }
      if (!m.wordClassId) {
        issues.push({ field: 'meanings.word_class_id', message: 'Kelas kata wajib dipilih' });
      }
      if (m.definition !== undefined || m.translations?.length) {
        issues.push({ field: 'meanings', message: 'Definisi dan padanan diubah lewat kategori Ubah makna' });
      }
      break;
    }
    case 'add_meaning': {
      const m = oneMeaning();
      if (m && (m.action !== 'add' || m.meaningId)) {
        issues.push({ field: 'meanings', message: 'Kategori ini hanya untuk menambah makna baru' });
      }
      break;
    }
    case 'add_photo':
      if ((c.images ?? []).some((i) => i.action !== 'add')) {
        issues.push({ field: 'images', message: 'Hapus atau ganti foto lewat kategori Ubah foto' });
      }
      break;
    case 'change_photo':
      if (!(c.images ?? []).some((i) => i.action === 'remove' || i.action === 'set_primary')) {
        issues.push({ field: 'images', message: 'Pilih foto yang ingin diubah' });
      }
      break;
    case 'synonym':
    case 'antonym':
      if ((c.relations ?? []).some((r) => r.relationType !== code)) {
        issues.push({ field: 'relations', message: 'Jenis relasi tidak sesuai kategori' });
      }
      break;
  }

  return issues;
}

/**
 * True jika penolakan bisa mengembalikan semua efeknya: teks kata/makna
 * (snapshot) dan foto baru (staging). Selain itu usulan kontributor
 * pada kata belum terverifikasi menunggu antrean dulu.
 */
export function isRevertibleForApplyPending(c: ProposedChanges): boolean {
  if (c.categoryIdsToAdd?.length || c.categoryIdsToRemove?.length) return false;
  if (c.relations?.length || c.variants?.length) return false;
  if ((c.meanings ?? []).some((m) => m.action !== 'update')) return false;
  if ((c.images ?? []).some((i) => i.action !== 'add')) return false;
  return true;
}
