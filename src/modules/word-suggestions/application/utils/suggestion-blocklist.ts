import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import { isHeavyCensor } from '@/shared/moderation/assert-ugc-text-quality';
import type { ProposedChanges } from '../../domain/entities/word-suggestion.entity';
import type { ShapeIssue } from './suggestion-category-shape';

export interface CensoredSuggestion {
  changes: ProposedChanges;
  reasonText: string | null;
  issues: ShapeIssue[];
}

/**
 * Sensor teks bebas usulan (catatan, definisi, padanan, alasan) dengan
 * blocklist komentar. Lemma dan variasi tidak disaring: ejaan Sambas yang
 * netral bisa sama dengan kata terlarang bahasa Indonesia. Field yang
 * hilang lebih dari separuh ditolak, supaya entri tidak tersimpan sebagai `***`.
 *
 * ponytail: pencocokan utuh per kata; ejaan akal-akalan (spasi di tengah,
 * angka pengganti huruf) lolos. Upgrade: normalisasi leetspeak + spasi sebelum cocok.
 */
export function censorSuggestionText(
  changes: ProposedChanges,
  reasonText: string | null,
  blocked: string[],
): CensoredSuggestion {
  const issues: ShapeIssue[] = [];
  if (blocked.length === 0) return { changes, reasonText, issues };

  const censor = (value: string, field: string): string => {
    const filtered = applyBlocklistFilter(value, blocked);
    if (isHeavyCensor(value, filtered)) {
      issues.push({ field, message: 'Teks mengandung kata yang tidak pantas' });
    }
    return filtered;
  };

  const out: ProposedChanges = {
    ...changes,
    notes: changes.notes === undefined ? undefined : censor(changes.notes, 'notes'),
    meanings: changes.meanings?.map((m, i) => ({
      ...m,
      definition:
        m.definition === undefined ? undefined : censor(m.definition, `meanings.${i}.definition`),
      translations: m.translations?.map((t, j) => ({
        ...t,
        translationText: censor(t.translationText, `meanings.${i}.translations.${j}.translation_text`),
      })),
    })),
  };

  return {
    changes: out,
    reasonText: reasonText === null ? null : censor(reasonText, 'reason_text'),
    issues,
  };
}
