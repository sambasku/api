import { z } from 'zod';
import { consentItemSchema } from '@/modules/legal/presentation/v1/validators/legal.validator';

/**
 * Normalisasi no HP ke digit internasional tanpa '+':
 * contoh: 6289988887777, 60123456789
 *
 * - Kosong → null
 * - Diawali 62… / +62… → simpan digit
 * - Nasional ID (08… / 8…) → 62…
 * - Internasional negara lain (8–15 digit, tidak leading 0) → terima
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Sudah ID internasional
  if (digits.startsWith('62') && /^62\d{8,13}$/.test(digits)) {
    return digits;
  }

  // Nasional ID: 08… atau 8…
  let national = digits;
  if (national.startsWith('0')) national = national.slice(1);
  if (/^8\d{7,12}$/.test(national)) {
    return `62${national}`;
  }

  // Internasional negara lain (E.164 tanpa '+')
  if (!digits.startsWith('0') && /^\d{8,15}$/.test(digits)) {
    return digits;
  }

  return '__INVALID__';
}

/** Alias kompatibilitas; pakai normalizePhone. */
export const normalizeIdPhone = normalizePhone;

export const registerSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.email(),
    phone: z.string().max(20).optional(),
    password: z.string().min(8).regex(/[a-zA-Z]/, 'harus mengandung huruf').regex(/[0-9]/, 'harus mengandung angka'),
    confirm_password: z.string(),
    client_id: z.string().min(1).max(64).optional(),
    consents: z.array(consentItemSchema).min(2, 'Wajib menyertakan terms dan privacy'),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirm_password) {
      ctx.addIssue({
        code: 'custom',
        message: 'confirm_password harus sama dengan password',
        path: ['confirm_password'],
      });
    }
    const phone = normalizePhone(d.phone);
    if (phone === '__INVALID__') {
      ctx.addIssue({
        code: 'custom',
        message: 'Nomor HP tidak valid (contoh: 81234567890 atau 6281234567890)',
        path: ['phone'],
      });
    }
  })
  .transform((d) => ({
    name: d.name.trim(),
    email: d.email,
    phone: (() => {
      const p = normalizePhone(d.phone);
      return p === '__INVALID__' ? null : p;
    })(),
    password: d.password,
    confirm_password: d.confirm_password,
    client_id: d.client_id ?? null,
    consents: d.consents,
  }));

export type RegisterBody = z.infer<typeof registerSchema>;

export const registerResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user_id: z.string(),
    username: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    verification_required: z.literal(true),
  }),
});
