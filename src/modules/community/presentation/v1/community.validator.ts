import { z } from 'zod';
import {
  COMMUNITY_FEATURED_KINDS,
} from '@/shared/database/drizzle/schema/community-orgs.schema';
import { COMMUNITY_PROPOSAL_STATUSES } from '@/shared/database/drizzle/schema/community-proposals.schema';
import { COMMUNITY_DESC_MAX } from '../../domain/community';

/** Id slug master `kategori_komunitas` (bukan ULID). */
export const communityCategoryIdSchema = z
  .string()
  .trim()
  .min(1, 'Kategori wajib dipilih')
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Kategori tidak valid. Pilih ulang dari daftar.',
  );

export const listCommunityQuerySchema = z.object({
  category_id: communityCategoryIdSchema.optional(),
  /** Alias lama `category` = id kategori. */
  category: communityCategoryIdSchema.optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const submitCommunityProposalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(COMMUNITY_DESC_MAX),
  logo_url: z.string().url().max(2000).optional().nullable(),
  category_id: communityCategoryIdSchema.optional(),
  /** Alias lama. */
  category: communityCategoryIdSchema.optional(),
});

export const communityOrgFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category_id: communityCategoryIdSchema,
  description: z.string().trim().min(1).max(COMMUNITY_DESC_MAX),
  logo_url: z.string().url().max(2000).optional().nullable(),
  cover_url: z.string().url().max(2000).optional().nullable(),
  is_featured_kind: z.enum(COMMUNITY_FEATURED_KINDS).optional().nullable(),
});

export const communityOrgPatchSchema = communityOrgFieldsSchema.partial();

export const approveCommunityProposalSchema = z.object({
  category_id: communityCategoryIdSchema.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(1).max(COMMUNITY_DESC_MAX).optional(),
  logo_url: z.string().url().max(2000).optional().nullable(),
  is_featured_kind: z.enum(COMMUNITY_FEATURED_KINDS).optional().nullable(),
});

export const rejectCommunityProposalSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

export const adminProposalListQuerySchema = z.object({
  status: z.enum(COMMUNITY_PROPOSAL_STATUSES).optional(),
});

export const setCommunityStatusSchema = z.object({
  status: z.enum(['published', 'archived']),
});
