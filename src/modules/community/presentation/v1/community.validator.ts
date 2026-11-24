import { z } from 'zod';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_FEATURED_KINDS,
} from '@/shared/database/drizzle/schema/community-orgs.schema';
import { COMMUNITY_PROPOSAL_STATUSES } from '@/shared/database/drizzle/schema/community-proposals.schema';
import { COMMUNITY_DESC_MAX } from '../../domain/community';

export const listCommunityQuerySchema = z.object({
  category: z.enum(COMMUNITY_CATEGORIES).optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const submitCommunityProposalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(COMMUNITY_DESC_MAX),
  logo_url: z.string().url().max(2000).optional().nullable(),
});

export const communityOrgFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(COMMUNITY_CATEGORIES),
  description: z.string().trim().min(1).max(COMMUNITY_DESC_MAX),
  logo_url: z.string().url().max(2000).optional().nullable(),
  cover_url: z.string().url().max(2000).optional().nullable(),
  is_featured_kind: z.enum(COMMUNITY_FEATURED_KINDS).optional().nullable(),
});

export const communityOrgPatchSchema = communityOrgFieldsSchema.partial();

export const approveCommunityProposalSchema = z.object({
  category: z.enum(COMMUNITY_CATEGORIES).optional(),
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
