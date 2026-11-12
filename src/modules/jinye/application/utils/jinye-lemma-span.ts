import { ValidationError } from '@/shared/errors/app-error';

const MAX_LINKS = 20;

export function assertValidSpan(body: string, start: number, end: number): string {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > body.length
  ) {
    throw new ValidationError([
      {
        field: 'start',
        message: 'Span tidak valid. Pilih teks di dalam status ya.',
      },
    ]);
  }
  const slice = body.slice(start, end);
  if (!slice.trim()) {
    throw new ValidationError([
      { field: 'start', message: 'Span tidak boleh kosong' },
    ]);
  }
  return slice;
}

export function assertNoOverlap(
  start: number,
  end: number,
  existing: Array<{ id: string; start: number; end: number }>,
  exceptId?: string,
): void {
  for (const e of existing) {
    if (exceptId && e.id === exceptId) continue;
    if (start < e.end && end > e.start) {
      throw new ValidationError([
        {
          field: 'start',
          message: 'Span bertabrakan dengan tautan lemma lain',
        },
      ]);
    }
  }
}

export function assertUnderLinkCap(count: number): void {
  if (count >= MAX_LINKS) {
    throw new ValidationError([
      {
        field: 'start',
        message: `Maksimal ${MAX_LINKS} tautan lemma per Jinye`,
      },
    ]);
  }
}
