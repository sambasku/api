import { z } from 'zod';
import {
  BALEHO_ACTION_TYPES,
  BALEHO_ENTITY_TYPES,
  BALEHO_EVENT_TYPES,
  BALEHO_MEDIA_TYPES,
} from '@/shared/database/drizzle/schema/baleho.schema';

const frameSchema = z.object({
  media_type: z.enum(BALEHO_MEDIA_TYPES),
  media_url: z.string().url().max(2000).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  cta_label: z.string().max(40).nullable().optional(),
  action_type: z.enum(BALEHO_ACTION_TYPES),
  action_payload: z.string().min(1).max(2000),
});

export const createBalehoPlacementBodySchema = z
  .object({
    slide: z.literal(1),
    col: z.number().int().min(0).max(3),
    row: z.number().int().min(0).max(4),
    w: z.number().int().min(1).max(4),
    h: z.number().int().min(1).max(2),
    referral_username: z.string().min(1).max(40).nullable().optional(),
    entity_type: z.enum(BALEHO_ENTITY_TYPES).nullable().optional(),
    entity_id: z.string().min(1).max(40).nullable().optional(),
    days: z.number().int().min(1).max(30).optional(),
    creative_id: z.string().min(1).max(40).nullable().optional(),
    frames: z.array(frameSchema).max(10).default([]),
  })
  .superRefine((val, ctx) => {
    if (!val.creative_id && val.frames.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['frames'],
        message: 'Minimal satu frame',
      });
    }
  });

export const balehoEventBodySchema = z.object({
  placement_id: z.string().min(1).max(40),
  frame_id: z.string().min(1).max(40).nullable().optional(),
  event_type: z.enum(BALEHO_EVENT_TYPES),
});

export const rejectBalehoBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const markPaidBalehoBodySchema = z.object({
  payment_proof_url: z.string().url().max(2000),
  payment_proof_file_id: z.string().min(1).max(200),
});
