import { z } from 'zod';

export const MAX_TEAM_NOTE_LINES = 5;
export const MAX_TEAM_NOTE_LINE_LEN = 400;
export const MAX_TEAM_NOTE_TOTAL_LEN = 2000;

/** Baris non-kosong setelah split newline. */
export function splitTeamNoteLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Normalisasi untuk simpan DB: trim, buang baris kosong, join `\n`. */
export function normalizeTeamNote(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return splitTeamNoteLines(trimmed).join('\n');
}

function refineTeamNote(val: string | null | undefined, ctx: z.RefinementCtx, path: string[]) {
  if (val === undefined || val === null) return;
  const lines = splitTeamNoteLines(val);
  if (lines.length > MAX_TEAM_NOTE_LINES) {
    ctx.addIssue({
      code: 'custom',
      message: 'Keterangan Tim maksimal 5 baris.',
      path,
    });
  }
  for (const line of lines) {
    if (line.length > MAX_TEAM_NOTE_LINE_LEN) {
      ctx.addIssue({
        code: 'custom',
        message: `Satu baris keterangan Tim maksimal ${MAX_TEAM_NOTE_LINE_LEN} karakter.`,
        path,
      });
      break;
    }
  }
}

export const teamNoteInputSchema = z
  .string()
  .trim()
  .max(MAX_TEAM_NOTE_TOTAL_LEN)
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    return normalizeTeamNote(v);
  })
  .superRefine((val, ctx) => refineTeamNote(val, ctx, []));

export const teamAsInputSchema = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  });

export const teamSortOrderInputSchema = z.number().int().min(0).nullable().optional();

export const adminUpdateTeamBodySchema = z
  .object({
    is_team: z.boolean().optional(),
    team_as: teamAsInputSchema,
    team_note: teamNoteInputSchema,
    team_sort_order: teamSortOrderInputSchema,
  })
  .strict();

export type AdminUpdateTeamBody = z.infer<typeof adminUpdateTeamBodySchema>;