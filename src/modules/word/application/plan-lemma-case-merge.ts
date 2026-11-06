import { normalizeLemma } from './utils/normalize-lemma';

export interface LemmaCaseRow {
  id: string;
  languageId: string;
  lemma: string;
  createdAt: number;
}

export interface LemmaCaseGroup {
  languageId: string;
  lemma: string;
  keepId: string;
  mergeIds: string[];
}

/**
 * Grup entri hidup yang sama setelah trim + lowercase.
 * Penunggu = createdAt paling lama, seri id terkecil.
 */
export function planLemmaCaseMerges(rows: LemmaCaseRow[]): LemmaCaseGroup[] {
  const buckets = new Map<string, LemmaCaseRow[]>();
  for (const row of rows) {
    const lemma = normalizeLemma(row.lemma);
    if (!lemma) continue;
    const key = `${row.languageId}\0${lemma}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const groups: LemmaCaseGroup[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const keep = ranked[0]!;
    groups.push({
      languageId: keep.languageId,
      lemma: normalizeLemma(keep.lemma),
      keepId: keep.id,
      mergeIds: ranked.slice(1).map((row) => row.id),
    });
  }

  groups.sort(
    (a, b) => a.lemma.localeCompare(b.lemma, 'id') || a.languageId.localeCompare(b.languageId),
  );
  return groups;
}
