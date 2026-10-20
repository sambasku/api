import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';

export const webImportStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed',
]);

export const webImportSupportTypeSchema = z.enum(['web', 'book', 'article', 'other']);

export const webImportRowSchema = z
  .object({
    kata: z
      .string({ error: 'Kolom kata wajib diisi' })
      .trim()
      .min(1, 'Kolom kata tidak boleh kosong')
      .max(100, 'Kata maksimal 100 karakter'),
    terjemahan: z.string().trim().max(500, 'Terjemahan maksimal 500 karakter').nullable().optional(),
    penjelasan_arti: z
      .string()
      .trim()
      .max(1000, 'Penjelasan arti maksimal 1000 karakter')
      .nullable()
      .optional(),
    type: z
      .string()
      .trim()
      .max(20, 'Tipe kelas kata maksimal 20 karakter')
      .nullable()
      .optional(),
    contoh: z.string().trim().max(1000, 'Contoh kalimat maksimal 1000 karakter').nullable().optional(),
    arti_contoh: z
      .string()
      .trim()
      .max(1000, 'Arti contoh kalimat maksimal 1000 karakter')
      .nullable()
      .optional(),
  })
  .strict();

export const submitWebImportBodySchema = z
  .object({
    officer_name: z
      .string({ error: 'Nama petugas wajib diisi' })
      .trim()
      .min(2, 'Nama petugas minimal 2 karakter')
      .max(100, 'Nama petugas maksimal 100 karakter'),
    source_label: z.string().trim().max(200).optional(),
    support_name: z.string().trim().max(200).optional(),
    support_type: webImportSupportTypeSchema.optional(),
    support_address: z.string().trim().max(500).optional(),
    support_title: z.string().trim().max(300).optional(),
    support_desc: z.string().trim().max(1000).optional(),
    rows: z
      .array(webImportRowSchema)
      .min(1, 'Minimal satu baris data untuk diajukan')
      .max(500, 'Maksimal 500 baris per sekali submit'),
  })
  .strict();

export const listWebImportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: opaqueId.optional(),
  status: webImportStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});

export const webImportIdParamsSchema = z.object({
  id: opaqueId,
});

export const previewWebImportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  before: z.coerce.number().int().min(1).optional(),
});

export const approveWebImportBodySchema = z
  .object({
    note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional(),
  })
  .strict();

export const rejectWebImportBodySchema = z
  .object({
    note: z
      .string({ error: 'Catatan penolakan wajib diisi' })
      .trim()
      .min(3, 'Catatan penolakan minimal 3 karakter agar jelas')
      .max(500, 'Catatan penolakan maksimal 500 karakter'),
  })
  .strict();

// Response schemas
export const webImportDetailResponseSchema = z.object({
  id: z.string(),
  import_id: z.string(),
  row_number: z.number(),
  kata: z.string(),
  terjemahan: z.string().nullable(),
  penjelasan_arti: z.string().nullable(),
  type: z.string().nullable(),
  contoh: z.string().nullable(),
  arti_contoh: z.string().nullable(),
  status: z.string(),
  admin_note: z.string().nullable(),
  outcome: z.string().nullable(),
  outcome_message: z.string().nullable(),
  word_id: z.string().nullable(),
  created_at: z.number(),
});

export const webImportItemResponseSchema = z.object({
  id: z.string(),
  submitted_by: z.string(),
  officer_name: z.string(),
  source_label: z.string().nullable(),
  support_name: z.string().nullable(),
  support_type: webImportSupportTypeSchema.nullable(),
  support_address: z.string().nullable(),
  support_title: z.string().nullable(),
  support_desc: z.string().nullable(),
  status: webImportStatusSchema,
  total_rows: z.number(),
  reviewed_by: z.string().nullable(),
  reviewed_by_name: z.string().nullable(),
  reviewed_at: z.number().nullable(),
  review_note: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const submitWebImportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: webImportStatusSchema,
    total_rows: z.number(),
    officer_name: z.string(),
    created_at: z.number(),
  }),
});

export const getWebImportResponseSchema = z.object({
  success: z.literal(true),
  data: webImportItemResponseSchema,
});

export const listWebImportsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(webImportItemResponseSchema),
    next_cursor: z.string().nullable(),
  }),
});

export const previewWebImportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(webImportDetailResponseSchema),
    next_cursor: z.number().nullable(),
    has_more: z.boolean(),
  }),
});
