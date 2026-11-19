import { z } from "zod";
import { opaqueId } from "@/shared/validation/id";
import {
  eventCategorySchema,
  eventSourceTypeSchema,
} from "@/modules/event/presentation/v1/validators/event.validator";
import { EVENT_REJECT_REASON_CODES } from "../../../domain/event-reject-reason";

function optionalCoord(schema: z.ZodNumber) {
  return z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    schema.optional(),
  );
}

const sambasLat = optionalCoord(z.number().min(1.0).max(1.8));
const sambasLng = optionalCoord(z.number().min(108.5).max(110.0));


/** Query admin list usulan: periksa (pending) atau riwayat (decided) + cari. */
export const listEventContributionsQuerySchema = z
  .object({
    status: z
      .enum(["pending", "needs_revision", "approved", "rejected"])
      .optional(),
    /** "1" = usulan sudah diputus (approved|rejected|needs_revision). Diabaikan bila status diisi. */
    decided: z.literal("1").optional(),
    q: z.string().max(120).optional(),
  })
  .strict();

/** Body usulan acara - boleh anonim (pola place-contribution). */
export const submitEventContributionBodySchema = z
  .object({
    /** Slug dari pengusul diabaikan - slug final dibuat saat approve. */
    slug: z.string().max(120).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(8000).default(""),
    category_id: eventCategorySchema,
    /** Tanggal mulai wajib di usulan. */
    starts_at: z.coerce.date(),
    ends_at: z.coerce.date().nullable().optional(),
    location_text: z.string().max(500).default(""),
    lat: sambasLat,
    lng: sambasLng,
    maps_url: z.string().url().startsWith("https://").nullable().optional(),
    poster_urls: z
    .array(z.string().url().startsWith("https://"))
    .max(10)
    .optional(),

    organizer: z.string().max(200).nullable().optional(),
    /** Link original konten (FB/IG/website). Disimpan BERSIH tanpa UTM. */
    source_url: z.string().url().startsWith("https://").nullable().optional(),
    source_type: eventSourceTypeSchema.nullable().optional(),
    source_attribution: z.string().max(300).nullable().optional(),
    region_id: z.string().max(64).nullable().optional(),
    village_id: z.string().max(64).nullable().optional(),
    place_ids: z.array(opaqueId).max(20).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.ends_at &&
      v.ends_at.getTime() < v.starts_at.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Waktu selesai tidak boleh sebelum waktu mulai",
        path: ["ends_at"],
      });
    }
  });

/** Body resubmit = payload baru (sama dengan submit). */
export const resubmitEventContributionBodySchema =
  submitEventContributionBodySchema;

export const requestRevisionBodySchema = z
  .object({
    note: z.string().trim().min(3).max(1000),
  })
  .strict();

export const rejectEventContributionBodySchema = z
  .object({
    reason_code: z.enum(EVENT_REJECT_REASON_CODES),
    reason_text: z.string().trim().max(500).optional(),
  })
  .superRefine((body, ctx) => {
    if (
      body.reason_code === "other" &&
      !(body.reason_text && body.reason_text.length >= 3)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reason_text"],
        message: "reason_text wajib (min 3) jika reason_code=other",
      });
    }
  });
