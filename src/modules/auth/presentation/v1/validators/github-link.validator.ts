import { z } from 'zod';

export const githubLinkSchema = z
  .object({
    access_token: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    redirect_uri: z.string().min(1).optional(),
    code_verifier: z.string().min(1).optional(),
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

export type GithubLinkBody = z.infer<typeof githubLinkSchema>;

export const githubLinkResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    provider: z.literal('github'),
    linked_at: z.string(),
  }),
});

export const unlinkGithubResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
  }),
});
