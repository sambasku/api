import type { ProposedChanges } from './entities/word-suggestion.entity';

export interface WordClassHistoryPair {
  oldId: string | null;
  newId: string | null;
}

/** Label kelas kata untuk satu baris riwayat. Null kalau tidak ada yang berubah. */
export function formatWordClassDiff(
  pairs: { oldLabel: string | null; newLabel: string | null }[],
): { displayOld: string; displayNew: string } | null {
  const changed = pairs.filter((pair) => (pair.oldLabel ?? '') !== (pair.newLabel ?? ''));
  if (changed.length === 0) return null;
  const text = (label: string | null) => label?.trim() || '-';
  return {
    displayOld: changed.map((pair) => text(pair.oldLabel)).join(', '),
    displayNew: changed.map((pair) => text(pair.newLabel)).join(', '),
  };
}

/** Pasangan kelas lama (baseline) dan baru (usulan) untuk kategori ubah kelas kata. */
export function wordClassPairsFromSuggestion(
  proposed: ProposedChanges | null | undefined,
  baseline: { meanings?: { id?: string; wordClassId?: string | null }[] } | null | undefined,
): WordClassHistoryPair[] {
  const pairs: WordClassHistoryPair[] = [];
  for (const mc of proposed?.meanings ?? []) {
    if (mc.action !== 'update' || !mc.meaningId || mc.wordClassId === undefined) continue;
    const oldId = baseline?.meanings?.find((m) => m.id === mc.meaningId)?.wordClassId ?? null;
    if (oldId === mc.wordClassId) continue;
    pairs.push({ oldId, newId: mc.wordClassId });
  }
  return pairs;
}
