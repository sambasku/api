import { z } from 'zod';
import { consentItemSchema } from '@/modules/legal/presentation/v1/validators/legal.validator';
import { loginResponseSchema } from './login.validator';

export const googleLoginSchema = z.object({
  id_token: z.string().min(1, 'Token Google wajib diisi'),
  client_type: z.enum(['web', 'mobile']).default('web'),
  client_id: z.string().min(1).max(100).optional(),
  /** Opsional: app versi lama tidak mengirim. Lihat consent enforcement. */
  consents: z.array(consentItemSchema).max(4).optional(),
});

export type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

export { loginResponseSchema as googleLoginResponseSchema };
