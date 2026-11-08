import { z } from 'zod';
import { LAYANAN_PHONES_MAX, LAYANAN_PHONES_MIN } from '../../domain/layanan';

const optionalText = z.string().trim().max(500).nullish();

const phoneItemSchema = z.object({
  phone: z.string().trim().min(8).max(40),
  note: optionalText,
  whatsapp: optionalText,
});

export const layananFieldsSchema = z.object({
  category: z.enum(['ambulance', 'fire']),
  name: z.string().trim().min(2).max(120),
  phones: z.array(phoneItemSchema).min(LAYANAN_PHONES_MIN).max(LAYANAN_PHONES_MAX),
  logo_url: z.string().trim().max(500).nullish(),
  address_text: optionalText,
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  maps_url: z.string().trim().max(500).nullish(),
  region_id: z.string().trim().min(1).max(80),
  village_id: z.string().trim().max(80).nullish(),
  note: optionalText,
});

export const listLayananQuerySchema = z.object({
  region_id: z.string().trim().min(1).max(80).optional(),
  category: z.enum(['ambulance', 'fire']).optional(),
});

export const submitLayananSchema = layananFieldsSchema.extend({
  kind: z.enum(['new', 'edit']).default('new'),
  layanan_id: z.string().trim().min(1).max(40).nullish(),
});

export const rejectLayananSchema = z.object({
  reason_code: z.enum(['invalid_phone', 'wrong_region', 'duplicate', 'other']),
  reason_text: z.string().trim().max(500).nullish(),
});

export const revisionNoteSchema = z.object({
  note: z.string().trim().min(3).max(500),
});

export const contributionListQuerySchema = z.object({
  status: z.enum(['pending', 'needs_revision', 'approved', 'rejected']).optional(),
});
