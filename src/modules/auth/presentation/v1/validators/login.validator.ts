import { z } from 'zod';

export const loginSchema = z
  .object({
    // 'identifier' (email/username) dikirim mobile; 'email' legacy console/web.
    // identifier menang bila keduanya dikirim.
    identifier: z.string().min(1).max(320).optional(),
    email: z.email().optional(),
    password: z.string().min(1),
  // web (default): refresh_token via httpOnly cookie.
  // mobile: refresh_token dikirim di response body - client menyimpannya
  // di secure storage (Keychain/Keystore), lalu mengirimnya di body
  // ke /refresh dan /logout.
  client_type: z.enum(['web', 'mobile']).default('web'),
  /** Klaim first-party; default dari client_type bila kosong. */
  client_id: z.string().min(1).max(100).optional(),
  })
  .refine((v) => Boolean(v.identifier || v.email), {
    message: 'Email atau username wajib diisi ya.',
    path: ['identifier'],
  });

export type LoginBody = z.infer<typeof loginSchema>;

/** Email atau username untuk lookup user. identifier menang atas email. */
export function resolveLoginIdentifier(body: LoginBody): string {
  return (body.identifier ?? body.email ?? '').trim();
}

export const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    access_token: z.string(),
    expires_in: z.number().int(),
    refresh_token: z.string().optional(), // hanya ada untuk client_type 'mobile'
    /** True bila consent baru ditulis saat login - client tampilkan sheet. */
    requires_consent: z.boolean().optional(),
    user: z.object({
      id: z.string(), // ULID
      username: z.string(),
      display_name: z.string(),
      roles: z.array(z.string()).min(1),
      /** @deprecated Derived tertinggi dari roles (wire compat, baca roles). */
      role: z.string(),
      avatar_url: z.string().url().nullable(),
    }),
  }),
});

// Body opsional untuk refresh/logout - dipakai klien mobile;
// klien web tetap mengandalkan cookie (body kosong → {})
export const refreshTokenBodySchema = z
  .object({ refresh_token: z.string().min(1).optional() })
  .default({});

export const refreshResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    access_token: z.string(),
    expires_in: z.number().int(),
    refresh_token: z.string().optional(), // hanya untuk klien mobile (via body)
  }),
});
