import { z } from 'zod';
import {
  KARYA_FILM_CREDIT_ROLES,
  KARYA_FILM_TYPES,
  KARYA_KINDS,
  KARYA_MUSIC_CREDIT_ROLES,
  KARYA_MUSIC_RELEASE_TYPES,
} from '@/shared/database/drizzle/schema/karyas.schema';
import {
  KARYA_EXCERPT_FAIR_QUOTE_MAX_CHARS,
  KARYA_EXCERPT_FAIR_QUOTE_MAX_LINES,
  KARYA_EXCERPT_FULL_TEXT_RIGHTS,
  KARYA_EXCERPT_KINDS,
  KARYA_EXCERPT_RIGHTS_STATUSES,
} from '@/shared/database/drizzle/schema/karya-excerpts.schema';
import { KARYA_CONTRIBUTION_KINDS } from '@/shared/database/drizzle/schema/karya-contributions.schema';

export const KARYA_SAMBAS_CONNECTION_TYPES = [
  'creator_origin',
  'language',
  'location',
  'theme',
  'other',
] as const;

export const KARYA_ACCESS_LINK_KINDS = [
  'listen',
  'watch',
  'buy',
  'read',
  'stream',
  'official',
  'other',
] as const;

const nonEmpty = z.string().trim().min(1);

export const sambasConnectionSchema = z
  .object({
    type: z.enum(KARYA_SAMBAS_CONNECTION_TYPES),
    note: nonEmpty.max(500),
  })
  .strict();

export const accessLinkSchema = z
  .object({
    kind: z.enum(KARYA_ACCESS_LINK_KINDS),
    label: nonEmpty.max(80),
    url: z.string().url().max(2000),
    is_primary: z.boolean().optional(),
  })
  .strict();

export const karyaCreditInputSchema = z
  .object({
    role: nonEmpty.max(40),
    name_text: nonEmpty.max(200),
    kreator_id: z.string().min(1).max(26).nullable().optional(),
    sort_order: z.number().int().min(0).max(999).optional(),
  })
  .strict();

function countLines(text: string): number {
  if (!text) return 0;
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length;
}

/** True jika teks melebihi batas cuplikan fair_quote. */
export function exceedsFairQuoteLimit(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > KARYA_EXCERPT_FAIR_QUOTE_MAX_CHARS) return true;
  return countLines(trimmed) > KARYA_EXCERPT_FAIR_QUOTE_MAX_LINES;
}

export function isFullTextRights(
  status: (typeof KARYA_EXCERPT_RIGHTS_STATUSES)[number],
): boolean {
  return (KARYA_EXCERPT_FULL_TEXT_RIGHTS as readonly string[]).includes(status);
}

/**
 * Gate hak excerpt (KARYA.md #8-#10).
 * - unknown → tidak boleh publish
 * - fair_quote → wajib dalam batas cuplikan
 * - teks di luar batas → wajib A2 + rights_note
 */
export function assertExcerptRights(input: {
  text: string;
  rightsStatus: (typeof KARYA_EXCERPT_RIGHTS_STATUSES)[number];
  rightsNote?: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  const text = input.text.trim();
  if (!text) {
    return { ok: false, code: 'EXCERPT_EMPTY', message: 'Teks cuplikan wajib diisi' };
  }
  if (input.rightsStatus === 'unknown') {
    return {
      ok: false,
      code: 'EXCERPT_RIGHTS_UNKNOWN',
      message: 'Status hak unknown tidak boleh dipublish',
    };
  }
  const over = exceedsFairQuoteLimit(text);
  if (input.rightsStatus === 'fair_quote' && over) {
    return {
      ok: false,
      code: 'EXCERPT_FAIR_QUOTE_TOO_LONG',
      message: `Cuplikan fair_quote maks ${KARYA_EXCERPT_FAIR_QUOTE_MAX_LINES} baris atau ${KARYA_EXCERPT_FAIR_QUOTE_MAX_CHARS} karakter`,
    };
  }
  if (over && !isFullTextRights(input.rightsStatus)) {
    return {
      ok: false,
      code: 'EXCERPT_FULL_REQUIRES_A2',
      message:
        'Teks penuh hanya boleh dengan rights_status permission, licensed, atau public_domain',
    };
  }
  if (isFullTextRights(input.rightsStatus) && !input.rightsNote?.trim()) {
    return {
      ok: false,
      code: 'EXCERPT_RIGHTS_NOTE_REQUIRED',
      message: 'rights_note wajib diisi untuk teks berizin/lisensi/domain publik',
    };
  }
  return { ok: true };
}

function creditsHaveRequiredRole(
  kind: (typeof KARYA_KINDS)[number],
  credits: { role: string }[],
): boolean {
  const roles = new Set(credits.map((c) => c.role));
  if (kind === 'music') return roles.has('vocal');
  return roles.has('director') || roles.has('cast');
}

function creditRoleAllowed(
  kind: (typeof KARYA_KINDS)[number],
  role: string,
): boolean {
  if (kind === 'music') {
    return (KARYA_MUSIC_CREDIT_ROLES as readonly string[]).includes(role);
  }
  return (KARYA_FILM_CREDIT_ROLES as readonly string[]).includes(role);
}

const newKaryaPayloadBase = {
  title: nonEmpty.max(300),
  year: z.number().int().min(1800).max(2100),
  kind: z.enum(KARYA_KINDS),
  language: z.string().trim().min(2).max(16).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  cover_url: z.string().url().max(2000).optional().nullable(),
  sambas_connections: z.array(sambasConnectionSchema).min(1).max(10),
  access_links: z.array(accessLinkSchema).max(20).optional().default([]),
  credits: z.array(karyaCreditInputSchema).min(1).max(50),
  music_release_type: z.enum(KARYA_MUSIC_RELEASE_TYPES).optional().nullable(),
  music_duration_ms: z.number().int().min(0).max(86_400_000).optional().nullable(),
  music_is_cover: z.boolean().optional(),
  film_type: z.enum(KARYA_FILM_TYPES).optional().nullable(),
  film_runtime_min: z.number().int().min(1).max(1000).optional().nullable(),
};

/** Payload usulan kind=new (min field KARYA.md #6). */
export const newKaryaPayloadSchema = z
  .object(newKaryaPayloadBase)
  .strict()
  .superRefine((data, ctx) => {
    if (!creditsHaveRequiredRole(data.kind, data.credits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['credits'],
        message:
          data.kind === 'music'
            ? 'Musik wajib punya minimal satu credit role vocal'
            : 'Film wajib punya minimal satu credit role director atau cast',
      });
    }
    for (let i = 0; i < data.credits.length; i++) {
      if (!creditRoleAllowed(data.kind, data.credits[i]!.role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['credits', i, 'role'],
          message: `Role tidak valid untuk kind ${data.kind}`,
        });
      }
    }
  });

export const excerptPayloadSchema = z
  .object({
    kind: z.enum(KARYA_EXCERPT_KINDS),
    text: nonEmpty.max(100_000),
    language: z.string().trim().min(2).max(16).optional().nullable(),
    start_label: z.string().trim().max(80).optional().nullable(),
    end_label: z.string().trim().max(80).optional().nullable(),
    rights_status: z.enum(KARYA_EXCERPT_RIGHTS_STATUSES),
    rights_note: z.string().trim().max(1000).optional().nullable(),
    source_url: z.string().url().max(2000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const gate = assertExcerptRights({
      text: data.text,
      rightsStatus: data.rights_status,
      rightsNote: data.rights_note,
    });
    if (!gate.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: `${gate.code}: ${gate.message}`,
      });
    }
  });

export const submitKaryaContributionBodySchema = z
  .object({
    kind: z.enum(KARYA_CONTRIBUTION_KINDS),
    karya_id: z.string().min(1).max(26).optional().nullable(),
    payload: z.unknown(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'new') {
      const parsed = newKaryaPayloadSchema.safeParse(data.payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['payload', ...issue.path],
          });
        }
      }
      if (data.karya_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['karya_id'],
          message: 'kind=new tidak boleh menyertakan karya_id',
        });
      }
      return;
    }
    if (!data.karya_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['karya_id'],
        message: 'karya_id wajib untuk kind edit/excerpt',
      });
    }
    if (data.kind === 'excerpt') {
      const parsed = excerptPayloadSchema.safeParse(data.payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['payload', ...issue.path],
          });
        }
      }
    }
  });

export const listKaryaQuerySchema = z.object({
  kind: z.enum(KARYA_KINDS).optional(),
  year: z.coerce.number().int().min(1800).max(2100).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
