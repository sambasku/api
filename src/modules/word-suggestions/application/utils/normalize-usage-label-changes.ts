import type { ProposedChanges } from '../../domain/entities/word-suggestion.entity';
import { BadRequestError } from '@/shared/errors/app-error';
import { hasConflictingUsageLabels, USAGE_LABEL_SET } from '@/shared/constants/usage-labels';

/** Buang no-op add/remove; tolak konflik halus+kasar dan label tidak dikenal. */
export function normalizeUsageLabelChanges(
  current: readonly string[],
  c: ProposedChanges,
): ProposedChanges {
  if (
    (c.usageLabelsToAdd?.length ?? 0) === 0 &&
    (c.usageLabelsToRemove?.length ?? 0) === 0
  ) {
    return c;
  }

  const cur = new Set(current);
  const rawAdd = [...new Set(c.usageLabelsToAdd ?? [])];
  const rawRemove = [...new Set(c.usageLabelsToRemove ?? [])];
  for (const code of [...rawAdd, ...rawRemove]) {
    if (!USAGE_LABEL_SET.has(code)) {
      throw new BadRequestError('INVALID_SUGGESTION_CHANGES', 'Label tidak valid', [
        { field: 'usage_labels_to_add', message: `Label tidak dikenal: ${code}` },
      ]);
    }
  }

  const usageLabelsToAdd = rawAdd.filter((l) => !cur.has(l));
  const usageLabelsToRemove = rawRemove.filter((l) => cur.has(l));

  if (usageLabelsToAdd.length === 0 && usageLabelsToRemove.length === 0) {
    throw new BadRequestError('SUGGESTION_NO_CHANGES', 'Tidak ada yang berubah dari data sekarang', [
      { field: 'usage_labels', message: 'Label masih sama dengan data sekarang' },
    ]);
  }

  const next = new Set(cur);
  for (const l of usageLabelsToRemove) next.delete(l);
  for (const l of usageLabelsToAdd) next.add(l);
  if (hasConflictingUsageLabels([...next])) {
    throw new BadRequestError('INVALID_SUGGESTION_CHANGES', 'Label tidak valid', [
      {
        field: 'usage_labels',
        message: 'Label halus dan kasar tidak bisa dipilih bersamaan',
      },
    ]);
  }

  return {
    ...c,
    usageLabelsToAdd: usageLabelsToAdd.length ? usageLabelsToAdd : undefined,
    usageLabelsToRemove: usageLabelsToRemove.length ? usageLabelsToRemove : undefined,
  };
}