import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

const subjectKind = z.enum(['ip', 'device'], { error: 'Jenis harus ip atau device' });
const pageQuery = {
  signal: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: opaqueId.optional(),
};
const pageMeta = z.object({
  limit: z.number().int(),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});
const metaRecord = z.record(z.string(), z.unknown()).nullable();

export const listUserAbuseEventsQuerySchema = z.object({
  ...pageQuery,
  /** partial match username (case-insensitive) */
  user_name: z.string().max(100).optional(),
});
export type ListUserAbuseEventsQuery = z.infer<typeof listUserAbuseEventsQuerySchema>;

export const userAbuseEventListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      username: z.string().nullable(),
      user_can_contribute: z.boolean().nullable(),
      user_muted_until: z.string().nullable(),
      signal: z.string(),
      weight: z.number().int(),
      entity_type: z.string().nullable(),
      entity_id: z.string().nullable(),
      meta: metaRecord,
      created_at: z.string(),
    }),
  ),
  meta: pageMeta,
});

export const listAnonAbuseEventsQuerySchema = z.object({
  ...pageQuery,
  subject_kind: subjectKind.optional(),
  subject_key: z.string().trim().max(200).optional(),
});
export type ListAnonAbuseEventsQuery = z.infer<typeof listAnonAbuseEventsQuerySchema>;

export const anonAbuseEventListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      id: z.string(),
      subject_kind: subjectKind,
      subject_key: z.string(),
      signal: z.string(),
      weight: z.number().int(),
      entity_type: z.string().nullable(),
      entity_id: z.string().nullable(),
      meta: metaRecord,
      created_at: z.string(),
    }),
  ),
  meta: pageMeta,
});

export const anonMuteListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      subject_kind: subjectKind,
      subject_key: z.string(),
      muted_until: z.string(),
      updated_at: z.string().nullable(),
    }),
  ),
});

export const liftAnonMuteBodySchema = z.object({
  subject_kind: subjectKind,
  subject_key: z.string({ error: 'Kunci wajib diisi' }).trim().min(1, 'Kunci wajib diisi').max(200),
});
export type LiftAnonMuteBody = z.infer<typeof liftAnonMuteBodySchema>;

export const liftAnonMuteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    subject_kind: subjectKind,
    subject_key: z.string(),
    removed: z.boolean(),
    previous_score_30d: z.number(),
  }),
});

export const liftUserMuteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    contribute_muted_until: z.null(),
    previous_score_30d: z.number(),
  }),
});
