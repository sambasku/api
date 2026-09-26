import { z } from 'zod';
import { FIRST_PARTY_SCOPES } from '../../../domain/entities/api-client.entity';
import { opaqueId } from '@/shared/validation/id';

const scopeEnum = z.enum(FIRST_PARTY_SCOPES);
const statusEnum = z.enum(['pending', 'approved', 'suspended', 'revoked']);
const channelEnum = z.enum(['web', 'mobile']);

export const listAdminApiClientsQuerySchema = z.object({
  status: statusEnum.optional(),
  is_first_party: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: opaqueId.optional(),
});

export const apiClientIdParamsSchema = z.object({
  id: opaqueId,
});

export const createAdminApiClientBodySchema = z.object({
  client_id: z
    .string({ error: 'client_id wajib diisi' })
    .trim()
    .min(3, 'client_id minimal 3 karakter')
    .max(64, 'client_id maksimal 64 karakter'),
  name: z.string({ error: 'Nama wajib diisi' }).trim().min(1, 'Nama wajib diisi').max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  status: statusEnum.optional(),
  homepage_url: z.string().trim().url('URL beranda tidak valid').nullable().optional(),
  privacy_url: z.string().trim().url('URL privasi tidak valid').nullable().optional(),
  redirect_uris: z.array(z.string().url('Redirect URI tidak valid')).max(20).optional(),
  allowed_scopes: z.array(scopeEnum).min(1, 'Minimal satu scope'),
  allowed_channels: z.array(channelEnum).min(1, 'Minimal satu channel'),
  rate_limit_tier: z.string().trim().min(1).max(40).optional(),
});

export const updateAdminApiClientBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi').max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: statusEnum.optional(),
    homepage_url: z.string().trim().url('URL beranda tidak valid').nullable().optional(),
    privacy_url: z.string().trim().url('URL privasi tidak valid').nullable().optional(),
    redirect_uris: z.array(z.string().url('Redirect URI tidak valid')).max(20).optional(),
    allowed_scopes: z.array(scopeEnum).min(1, 'Minimal satu scope').optional(),
    allowed_channels: z.array(channelEnum).min(1, 'Minimal satu channel').optional(),
    rate_limit_tier: z.string().trim().min(1).max(40).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'Minimal satu field diubah',
  });

export const apiClientAdminSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  owner_user_id: z.string().nullable(),
  status: statusEnum,
  is_first_party: z.boolean(),
  homepage_url: z.string().nullable(),
  privacy_url: z.string().nullable(),
  redirect_uris: z.array(z.string()),
  allowed_scopes: z.array(z.string()),
  allowed_channels: z.array(channelEnum),
  rate_limit_tier: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const apiClientAdminResponseSchema = z.object({
  success: z.literal(true),
  data: apiClientAdminSchema,
});

export const apiClientAdminListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(apiClientAdminSchema),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export type ListAdminApiClientsQuery = z.infer<typeof listAdminApiClientsQuerySchema>;
export type CreateAdminApiClientBody = z.infer<typeof createAdminApiClientBodySchema>;
export type UpdateAdminApiClientBody = z.infer<typeof updateAdminApiClientBodySchema>;
