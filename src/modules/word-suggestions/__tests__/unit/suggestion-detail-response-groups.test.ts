import { describe, expect, it } from 'vitest';
import { suggestionDetailResponseSchema } from '../../presentation/v1/validators/suggestion.validator';

/** Payload minimal yang meniru wire `getSuggestionDetail` (tanpa groups = bug #relasi-lemma). */
function baseDetailPayload(overrides?: {
  groups?: unknown;
  diffGroups?: unknown;
  omitGroups?: boolean;
}) {
  const currentWord: Record<string, unknown> = {
    lemma: 'uji',
    notes: null,
    word_type: 'word',
    meanings: [],
    examples: [],
    category_ids: [],
    relations: [],
    variants: [],
    images: [],
  };
  const diff: Record<string, unknown> = {
    lemma: { current: 'uji', proposed: null, changed: false },
    notes: { current: null, proposed: null, changed: false },
    word_type: { current: 'word', proposed: null, changed: false },
    meanings: [],
    examples: [],
    categories: { added: [], removed: [] },
    relations: { added: [], removed: [] },
    variants: { added: [], removed: [] },
    images: { added: [], removed: [], set_primary: [] },
  };

  if (!overrides?.omitGroups) {
    currentWord.groups = overrides?.groups ?? [];
    diff.groups = overrides?.diffGroups ?? { joined: [], left: [], created: [] };
  }

  return {
    success: true as const,
    data: {
      suggestion: {
        id: '01M69XA0JH7BR5XC5CJHZKTE7M',
        word_id: '01HZZZZZZZZZZZZZZZZZZZZZZ1',
        word_lemma: 'uji',
        contributor_id: '01HZZZZZZZZZZZZZZZZZZZZZZ2',
        contributor_username: 'admin',
        contributor_display_name: null,
        reason: 'Tambah makna',
        reason_code: 'add_meaning',
        proposed_changes: {},
        status: 'pending' as const,
        created_at: '2026-11-01T00:00:00.000Z',
      },
      current_word: currentWord,
      diff,
    },
  };
}

function expectParseOk(payload: unknown) {
  const result = suggestionDetailResponseSchema.safeParse(payload);
  if (!result.success) {
    expect.fail(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  }
}

describe('suggestionDetailResponseSchema groups (relasi-lemma)', () => {
  it('gagal bila current_word.groups / diff.groups absen (regresi console detail)', () => {
    const result = suggestionDetailResponseSchema.safeParse(baseDetailPayload({ omitGroups: true }));
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('data.current_word.groups');
    expect(paths).toContain('data.diff.groups');
  });

  it('lulus dengan groups kosong (usulan tanpa perubahan kelompok)', () => {
    expectParseOk(baseDetailPayload());
  });

  it('lulus dengan groups terisi', () => {
    const groupId = '01HZZZZZZZZZZZZZZZZZZZZZZ3';
    expectParseOk(
      baseDetailPayload({
        groups: [{ group_id: groupId, name: 'kenapa', member_word_ids: [] }],
        diffGroups: {
          joined: [{ group_id: groupId, name: 'kenapa' }],
          left: [],
          created: [],
        },
      }),
    );
  });
});
