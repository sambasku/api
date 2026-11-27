import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import { SPONSORSHIP_TIERS } from '@/shared/database/drizzle/schema/sponsorships.schema';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const sponsorshipTierSchema = z.enum(SPONSORSHIP_TIERS);

const sponsorshipItemSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  usaha_id: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  logo_url: z.string().nullable(),
  url: z.string().nullable(),
  username: z.string().nullable(),
  tier: sponsorshipTierSchema,
  since: z.string(),
  ends_on: z.string().nullable(),
  note: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const sponsorshipListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(sponsorshipItemSchema),
  }),
});

export const adminSponsorshipListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(sponsorshipItemSchema),
  meta: z.object({
    limit: z.number(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const sponsorshipItemResponseSchema = z.object({
  success: z.literal(true),
  data: sponsorshipItemSchema,
});

export const createSponsorshipBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  url: z.string().url().nullable().optional(),
  username: z.string().trim().min(1).max(64).nullable().optional(),
  tier: sponsorshipTierSchema.optional(),
  since: isoDateSchema,
  ends_on: isoDateSchema.nullable().optional(),
  note: z.string().trim().max(2000).optional(),
  user_id: opaqueId.nullable().optional(),
  usaha_id: opaqueId.nullable().optional(),
});

export const updateSponsorshipBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  url: z.string().url().nullable().optional(),
  username: z.string().trim().min(1).max(64).nullable().optional(),
  tier: sponsorshipTierSchema.optional(),
  since: isoDateSchema.optional(),
  ends_on: isoDateSchema.nullable().optional(),
  note: z.string().trim().max(2000).optional(),
  user_id: opaqueId.nullable().optional(),
  usaha_id: opaqueId.nullable().optional(),
});

export const listAdminSponsorshipsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: opaqueId.optional(),
});

export const teamListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        username: z.string(),
        display_name: z.string(),
        avatar_url: z.string().nullable(),
        team_as: z.string().nullable(),
        team_note: z.string().nullable(),
      }),
    ),
  }),
});

export const contributorsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: opaqueId.optional(),
});

export const contributorsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        username: z.string(),
        display_name: z.string(),
      }),
    ),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const verifiersListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: opaqueId.optional(),
});

export const verifiersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        username: z.string(),
        display_name: z.string(),
        avatar_url: z.string().nullable(),
      }),
    ),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const setUserSponsorBodySchema = z.object({
  is_sponsor: z.boolean(),
});

import { adminUpdateTeamBodySchema } from '@/shared/validation/team-note';

export const setUserTeamBodySchema = adminUpdateTeamBodySchema;

export type CreateSponsorshipBody = z.infer<typeof createSponsorshipBodySchema>;
export type UpdateSponsorshipBody = z.infer<typeof updateSponsorshipBodySchema>;
export type ListAdminSponsorshipsQuery = z.infer<typeof listAdminSponsorshipsQuerySchema>;
export type ContributorsListQuery = z.infer<typeof contributorsListQuerySchema>;
export type VerifiersListQuery = z.infer<typeof verifiersListQuerySchema>;
export type SetUserSponsorBody = z.infer<typeof setUserSponsorBodySchema>;
export type SetUserTeamBody = z.infer<typeof setUserTeamBodySchema>;
