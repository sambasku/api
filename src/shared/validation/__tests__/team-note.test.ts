import { describe, expect, it } from 'vitest';
import { adminUpdateTeamBodySchema, normalizeTeamNote, splitTeamNoteLines } from '../team-note';

describe('team-note', () => {
  it('split dan normalisasi baris kosong', () => {
    expect(splitTeamNoteLines('a\n\n b \n')).toEqual(['a', 'b']);
    expect(normalizeTeamNote('a\n\n b ')).toBe('a\nb');
    expect(normalizeTeamNote('  ')).toBeNull();
  });

  it('tolak lebih dari 5 baris', () => {
    const body = '1\n2\n3\n4\n5\n6';
    const parsed = adminUpdateTeamBodySchema.safeParse({ team_note: body });
    expect(parsed.success).toBe(false);
  });

  it('terima 5 baris', () => {
    const parsed = adminUpdateTeamBodySchema.safeParse({
      team_note: 'a\nb\nc\nd\ne',
      team_sort_order: 10,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.team_note).toBe('a\nb\nc\nd\ne');
    }
  });
});