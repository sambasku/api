import { z } from 'zod';
import { normalizePhone } from './register.validator';

const ASSIGNABLE_ADMIN_ROLES = ['contributor', 'editor', 'reviewer', 'admin'] as const;
const ALL_ROLES = ['contributor', 'editor', 'reviewer', 'admin', 'root'] as const;
const roleEnum = z.enum(ALL_ROLES);

export const listAdminUsersQuerySchema = z.object({
  /** Partial match username, email, ATAU nomor HP (query angka: 08…/+62…/62…) */
  q: z.string().max(100).optional(),
  /** Filter exact role (exclude root dari filter UI, tapi backend allow untuk list).
   * Multi role: cocokkan user yang PUNYA role ini. */
  role: roleEnum.optional(),
  can_contribute: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Filter status verifikasi email (false = user mentok OTP / gagal kirim email). */
  email_verified: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** ULID cursor halaman sebelumnya (created_at,id compound) */
  cursor: z.string().length(26).optional(),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const updateUserRoleBodySchema = z.object({
  roles: z.array(z.enum(['contributor', 'editor', 'reviewer', 'admin'])).min(1).max(5),
});
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;

const adminUserWireSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  roles: z.array(roleEnum).min(1),
  /** @deprecated Derived tertinggi dari roles (wire compat, baca roles). */
  role: roleEnum,
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  can_contribute: z.boolean(),
  contribute_muted_until: z.string().nullable(),
  email_verified: z.boolean(),
  /** Waktu verifikasi email (ISO); null = belum terverifikasi. */
  email_verified_at: z.string().nullable(),
  /** OTP verifikasi terakhir; null = tidak ada OTP tertunda. */
  otp: z
    .object({
      created_at: z.string(),
      expires_at: z.string(),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export const adminUsersListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(adminUserWireSchema),
  meta: z.object({
    limit: z.number().int(),
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export const createAdminUserBodySchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    email: z.email(),
    phone: z.string().max(20).optional(),
    password: z.string().min(8).regex(/[a-zA-Z]/, 'harus mengandung huruf').regex(/[0-9]/, 'harus mengandung angka'),
    confirm_password: z.string(),
    // Accept both: new `roles` (array) and legacy `role` (string)
    roles: z.array(z.enum(ASSIGNABLE_ADMIN_ROLES)).min(1).max(5).optional(),
    role: z.enum(ASSIGNABLE_ADMIN_ROLES).optional(),
    is_active: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirm_password) {
      ctx.addIssue({
        code: 'custom',
        message: 'confirm_password harus sama dengan password',
        path: ['confirm_password'],
      });
    }
    if (normalizePhone(d.phone) === '__INVALID__') {
      ctx.addIssue({
        code: 'custom',
        message: 'Nomor HP tidak valid (contoh: 81234567890 atau 6281234567890)',
        path: ['phone'],
      });
    }
    // At least one of roles or role must be provided
    if (!d.roles?.length && !d.role) {
      ctx.addIssue({
        code: 'custom',
        message: 'Peran wajib diisi (roles atau role)',
        path: ['roles'],
      });
    }
  })
  .transform((d) => {
    const phone = normalizePhone(d.phone);
    // Normalize: prefer roles array, fallback to single role
    const normalizedRoles = d.roles?.length ? [...new Set(d.roles)] : (d.role ? [d.role] : []);
    return {
      username: d.username,
      email: d.email,
      phone: phone === '__INVALID__' ? null : phone,
      password: d.password,
      confirm_password: d.confirm_password,
      roles: normalizedRoles,
      is_active: d.is_active,
    };
  });
export type CreateAdminUserBody = z.infer<typeof createAdminUserBodySchema>;

export const setUserActiveBodySchema = z.object({
  is_active: z.boolean(),
});
export type SetUserActiveBody = z.infer<typeof setUserActiveBodySchema>;

export const adminUserMutationResponseSchema = z.object({
  success: z.literal(true),
  data: adminUserWireSchema,
});

export const setUserActiveResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    is_active: z.boolean(),
  }),
});

export const updateUserRoleResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    roles: z.array(roleEnum).min(1),
    /** @deprecated Derived tertinggi dari roles (wire compat, baca roles). */
    role: roleEnum,
  }),
});

// Verifikasi email manual oleh admin (mis. OTP gagal terkirim ke user).
export const verifyEmailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    email_verified: z.literal(true),
    email_verified_at: z.string(),
  }),
});
