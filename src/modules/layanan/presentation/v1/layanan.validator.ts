import { z } from 'zod';

export const layananCategorySchema = z.enum(['ambulance', 'fire']);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const layananFieldsSchema = z.object({
  category: layananCategorySchema,
  name: z.string().trim().min(3, 'Nama minimal 3 huruf').max(200),
  phone: z.string().trim().min(8, 'Nomor telepon terlalu pendek').max(40),
  whatsapp: optionalText(40),
  address_text: optionalText(300),
  lat: z.number().gte(-90).lte(90).nullable().optional(),
  lng: z.number().gte(-180).lte(180).nullable().optional(),
  maps_url: optionalText(500),
  region_id: z.string().trim().min(1, 'Kecamatan wajib dipilih').max(120),
  village_id: z.string().trim().max(120).nullable().optional(),
  note: optionalText(500),
});

export const listLayananQuerySchema = z.object({
  region_id: z.string().trim().min(1).max(120).optional(),
  category: layananCategorySchema.optional(),
});

export const submitLayananSchema = layananFieldsSchema.extend({
  kind: z.enum(['new', 'edit']).default('new'),
  layanan_id: z.string().trim().max(40).optional(),
});

export const rejectLayananSchema = z.object({
  reason_code: z.enum(['invalid_phone', 'wrong_region', 'duplicate', 'other']),
  reason_text: z.string().trim().max(500).optional(),
});

export const revisionLayananSchema = z.object({
  note: z.string().trim().min(3, 'Tulis catatan revisi').max(500),
});

export type LayananFieldsBody = z.infer<typeof layananFieldsSchema>;
export type SubmitLayananBody = z.infer<typeof submitLayananSchema>;
