import { z } from 'zod';

export const setPasswordSchema = z
  .object({
    provider: z.enum(['google', 'facebook', 'github']),
    id_token: z.string().min(1).optional(),
    access_token: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    redirect_uri: z.string().min(1).optional(),
    code_verifier: z.string().min(1).optional(),
    new_password: z
      .string()
      .min(8)
      .regex(/[a-zA-Z]/, 'harus mengandung huruf')
      .regex(/[0-9]/, 'harus mengandung angka'),
    confirm_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .superRefine((d, ctx) => {
    if (d.new_password !== d.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm_password'],
        message: 'Konfirmasi password tidak sama dengan password baru',
      });
    }
    if (d.provider === 'google' && !d.id_token?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id_token'],
        message: 'Token Google wajib diisi',
      });
    }
    if (d.provider === 'facebook' && !d.access_token?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['access_token'],
        message: 'Token Facebook wajib diisi',
      });
    }
    if (d.provider === 'github') {
      const hasAccess = !!d.access_token?.trim();
      const hasCode = !!d.code?.trim() && !!d.redirect_uri?.trim();
      if (!hasAccess && !hasCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['access_token'],
          message: 'access_token atau code + redirect_uri wajib diisi',
        });
      }
    }
  });

export type SetPasswordBody = z.infer<typeof setPasswordSchema>;

export const setPasswordResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    login_with: z.string(),
  }),
});
