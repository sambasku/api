import { z } from 'zod';
import { loginResponseSchema } from './login.validator';

export const githubLoginSchema = z
  .object({
    access_token: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    redirect_uri: z.string().min(1).optional(),
    code_verifier: z.string().min(1).optional(),
    client_type: z.enum(['web', 'mobile']).default('web'),
    client_id: z.string().min(1).max(100).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.access_token?.trim()) return;
    if (val.code?.trim() && val.redirect_uri?.trim()) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'access_token atau code + redirect_uri wajib diisi',
      path: ['access_token'],
    });
  });

export type GithubLoginBody = z.infer<typeof githubLoginSchema>;

export { loginResponseSchema as githubLoginResponseSchema };
