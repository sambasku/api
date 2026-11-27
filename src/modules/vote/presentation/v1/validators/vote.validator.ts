import { z } from 'zod';
import type { VoteTarget, VoteTargetType } from '@/modules/vote/domain/repositories/vote.repository';
import { opaqueId } from '@/shared/validation/id';

const ulid = opaqueId;

export const voteTargetTypeEnum = z.enum([
'word',
'meaning',
'example',
'pronunciation',
'word_image',
'comment',
'discussion_reply',
'discussion',
'pantun',
'pantun_reply',
'article',
'article_comment',
'jinye',
'jinye_comment',
'place_comment',
'usaha_comment',
'cuisine_comment',
'event_comment',
'karya_comment',
]);

export const toggleVoteSchema = z.object({
  target_type: voteTargetTypeEnum,
  target_id: ulid,
  // 1 = upvote, -1 = downvote (0 tidak diterima - batal = vote searah ulang)
  value: z.union([z.literal(1), z.literal(-1)]),
});

export type ToggleVoteBody = z.infer<typeof toggleVoteSchema>;

// Panjang 26 + enum type cukup sebagai guard format; guard sesungguhnya
// adalah cek eksistensi di use case (404). Alfabet sengaja longgar
// ([0-9A-Za-z], bukan Crockford ketat) karena fixture ULID handmade di
// repo memakai huruf bebas (mis. 01U2E... mengandung U).
// Dibangun dari enum supaya tipe baru (pantun, jinye, dst.) ikut valid di
// /votes/counts dan /votes/my tanpa perlu menyalin daftar dua kali.
const TARGET_PATTERN = new RegExp(
  `^(${voteTargetTypeEnum.options.join('|')}):[0-9A-Za-z]{26}$`,
);
export const MAX_VOTE_TARGETS = 50;

// "word:01X,meaning:01Y" → array target tervalidasi (trim, dedupe, maks 50)
export const targetsQuerySchema = z.object({
  targets: z.string().transform((val, ctx) => {
    const items = [...new Set(val.split(',').map((s) => s.trim()).filter(Boolean))];
    if (
      items.length === 0 ||
      items.length > MAX_VOTE_TARGETS ||
      items.some((i) => !TARGET_PATTERN.test(i))
    ) {
      ctx.addIssue({
        code: 'custom',
        input: val,
        message: `targets harus 1-${MAX_VOTE_TARGETS} pasang "type:id" (ULID 26 char) dipisah koma`,
      });
      return z.NEVER;
    }
    return items.map((i) => {
      const [entityType, entityId] = i.split(':') as [VoteTargetType, string];
      return { entityType, entityId } satisfies VoteTarget;
    });
  }),
});

export const toggleVoteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    target_type: voteTargetTypeEnum,
    target_id: z.string(),
    my_vote: z.union([z.literal(1), z.literal(-1), z.null()]),
    upvotes: z.number().int(),
    downvotes: z.number().int(),
  }),
});

export const voteCountsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      target_type: voteTargetTypeEnum,
      target_id: z.string(),
      upvotes: z.number().int(),
      downvotes: z.number().int(),
    }),
  ),
});

export const voteCommunityStatusEnum = z.enum(['pending', 'verified', 'rejected']);

export const voteHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: opaqueId.optional(),
  target_type: voteTargetTypeEnum.optional(),
  value: z.enum(['1', '-1']).optional(),
  /** Filter hasil komunitas (hanya meaning) - Periksa Kata. */
  community_status: voteCommunityStatusEnum.optional(),
  /** Cari lemma kata induk (case-insensitive). */
  q: z.string().trim().min(1).max(100).optional(),
});

export type VoteHistoryQuery = z.infer<typeof voteHistoryQuerySchema>;

const voteHistoryWordSchema = z.object({
  id: z.string(),
  lemma: z.string(),
  word_type: z.string(),
  is_verified: z.boolean(),
});

export const voteHistoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      target_type: voteTargetTypeEnum,
      target_id: z.string(),
      value: z.union([z.literal(1), z.literal(-1)]),
      voted_at: z.string(),
      word: voteHistoryWordSchema.nullable(),
      community_status: voteCommunityStatusEnum.nullable(),
      upvotes: z.number().int().nonnegative(),
      downvotes: z.number().int().nonnegative(),
      definition: z.string().nullable(),
      translation: z.string().nullable(),
      contributor_username: z.string().nullable(),
      contributor_display_name: z.string().nullable(),
    }),
  ),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const myVotesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      target_type: voteTargetTypeEnum,
      target_id: z.string(),
      value: z.union([z.literal(1), z.literal(-1)]),
    }),
  ),
});

/** GET /api/v1/votes/deck - antrean makna belum di-vote (34-api-vote-deck.md, 0101). */
export const voteDeckQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  cursor: z.string().min(1).optional(),
  /** false = urutan kronologis (default: acak per user, lihat 34-api). */
  randomize: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === undefined || v === true || v === 'true' || v === '1'),
  /** Cari lemma / definisi (case-insensitive) - Periksa Kata. */
  q: z.string().trim().min(1).max(100).optional(),
});

export type VoteDeckQuery = z.infer<typeof voteDeckQuerySchema>;

/**
 * GET /api/v1/votes/check-deck - Periksa Kata. Default `randomize=false`
 * supaya antrean selalu urut voting terbanyak (#379); deck verified tetap acak.
 */
export const voteCheckDeckQuerySchema = voteDeckQuerySchema.extend({
  randomize: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

export type VoteCheckDeckQuery = z.infer<typeof voteCheckDeckQuerySchema>;

/** 52: meaning_id (client baru) atau word_id (mobile ≤ v0.4.0). */
export const skipVoteDeckSchema = z
  .object({
    meaning_id: opaqueId.optional(),
    word_id: opaqueId.optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.meaning_id && !body.word_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['meaning_id'],
        message: 'Wajib mengisi meaning_id atau word_id',
      });
    }
  });

export type SkipVoteDeckBody = z.infer<typeof skipVoteDeckSchema>;

/** Path param: meaning id atau word id (compat 52). */
export const skipVoteDeckParamsSchema = z.object({
  meaningId: opaqueId,
});

export const skipVoteDeckResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    meaning_id: z.string(),
    skipped: z.boolean(),
  }),
});

export const voteDeckResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      // 0101: id = ID makna (target vote), bukan ID kata.
      id: z.string(),
      word_id: z.string(),
      lemma: z.string(),
      language_id: z.string(),
      language_code: z.string(),
      word_type: z.string(),
      status: z.string(),
      is_verified: z.boolean(),
        approved_at: z.string(),
        // Definisi dan terjemahan dikirim terpisah; `sense` = definition ??
        // translation untuk klien lama (mobile <= v0.5.x).
        definition: z.string().nullable(),
        translation: z.string().nullable(),
        sense: z.string().nullable(),
      order_index: z.number().int(),
      meaning_count: z.number().int(),
      // Kelas kata milik MAKNA ini (bukan kata induk); null = belum diisi.
      word_class: z
        .object({
          id: z.string(),
          code: z.string(),
          name: z.string(),
          alias: z.string().nullable(),
        })
        .nullable(),
      upvotes: z.number().int(),
      downvotes: z.number().int(),
      contributor_username: z.string().nullable().optional(),
      contributor_display_name: z.string().nullable().optional(),
    }),
  ),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});
