import { z } from 'zod';
import { ACHIEVEMENT_CATEGORIES, REWARD_TYPES } from '@/shared/database/drizzle/schema/achievements.schema';
import { isAchievementSourceKnown } from '../../../domain/achievement-registry';

/**
 * Host aset reward yang diizinkan. URL ini dirender di profil publik -
 * bebas domain = vektor tracker/pixel eksternal (atau `javascript:` URL)
 * bila akun admin dibajak. Add hanyalah ini: host CDN baru = tambah di sini.
 */
const ALLOWED_BADGE_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'ik.imagekit.io',
]);

/**
 * URL aset reward: wajib https + host allowlist. Valid di level schema
 * supaya create dan update kena aturan sama.
 */
export const badgeUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((v) => v.startsWith('https://'), 'URL aset wajib https')
  .refine((v) => {
    try {
      return ALLOWED_BADGE_HOSTS.has(new URL(v).hostname);
    } catch {
      return false;
    }
  }, 'Host aset tidak diizinkan (pakai jsDelivr atau ImageKit)');


/**
 * Grammar kriteria achievement - divalidasi terhadap REGISTRY, bukan
 * menerima struktur bebas. Source tak dikenal = ACHIEVEMENT_CRITERIA_INVALID.
 *
 * `window` ISO 8601 WAJIB pakai offset waktu (mis. +07:00) supaya kohort
 * angkatan tidak pergeser timezone server. `from` harus < `to`.
 */
export const achievementCriteriaSchema = z
  .object({
    source: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .refine(isAchievementSourceKnown, 'source kriteria tidak dikenal'),
    threshold: z.number().int().min(1).nullable().optional(),
    window: z
      .object({
        from: z
          .string()
          .trim()
          .datetime({ offset: true })
          .refine((v) => !Number.isNaN(new Date(v).getTime()), 'from bukan tanggal valid'),
        to: z
          .string()
          .trim()
          .datetime({ offset: true })
          .refine((v) => !Number.isNaN(new Date(v).getTime()), 'to bukan tanggal valid'),
      })
      .nullable()
      .optional()
      .superRefine((w, ctx) => {
        if (w && new Date(w.from).getTime() >= new Date(w.to).getTime()) {
          ctx.addIssue({
            code: 'custom',
            path: ['to'],
            message: 'window.to harus setelah window.from',
          });
        }
      }),
    filters: z.record(z.string().trim().min(1).max(60), z.string().trim().min(1).max(120)).nullable().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.source === 'manual') {
      // Manual: tanpa threshold/window - pure pemberian admin.
      if (c.threshold != null) {
        ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'source manual tidak memakai threshold' });
      }
      if (c.window != null) {
        ctx.addIssue({ code: 'custom', path: ['window'], message: 'source manual tidak memakai window' });
      }
    }
  });

/** Slug kode achievement: lowercase, angka, hyphen. Stabil, tidak diubah. */
export const achievementCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'code hanya boleh huruf kecil, angka, dan hyphen');

export const createAchievementBodySchema = z.object({
  code: achievementCodeSchema,
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(500),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  reward_type: z.enum(REWARD_TYPES),
  badge_url: badgeUrlSchema.nullable(),
  criteria: achievementCriteriaSchema,
  family: z.string().trim().min(2).max(60).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

/** `code` tidak bisa di-update (dipakai integrasi). */
export const updateAchievementBodySchema = z.object({
  title: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().min(3).max(500).optional(),
  category: z.enum(ACHIEVEMENT_CATEGORIES).optional(),
  reward_type: z.enum(REWARD_TYPES).optional(),
  badge_url: badgeUrlSchema.nullable().optional(),
  criteria: achievementCriteriaSchema.optional(),
  family: z.string().trim().min(2).max(60).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const listAchievementsQuerySchema = z.object({
  reward_type: z.enum(REWARD_TYPES).optional(),
  category: z.enum(ACHIEVEMENT_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().length(26).optional(),
});

export const grantAchievementBodySchema = z.object({
  usernames: z.array(z.string().trim().min(2).max(40)).min(1).max(200),
});

export const scanAchievementBodySchema = z
  .object({
    limit: z.number().int().min(1).max(5000).optional(),
  })
  .optional()
  .default({});

/** Set / lepas border aktif: `{ border_id: string | null }`. */
export const setBorderBodySchema = z.object({
  border_id: z.string().length(26).nullable(),
});

// ---- response schemas (OpenAPI) ----

const criteriaResponseSchema = z.object({
  source: z.string(),
  threshold: z.number().int().nullable().optional(),
  window: z
    .object({ from: z.string(), to: z.string() })
    .nullable()
    .optional(),
  filters: z.record(z.string(), z.string()).nullable().optional(),
});

const achievementItemSchema = z.object({
  id: z.string().length(26),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  reward_type: z.string(),
  badge_url: z.string().nullable(),
  criteria: criteriaResponseSchema,
  family: z.string().nullable(),
  level: z.number().int().nullable(),
  is_active: z.boolean(),
  created_at: z.number().int(),
  updated_at: z.number().int().nullable(),
});

const achievementOwnershipSchema = achievementItemSchema.extend({
  /** Award id; null = belum dimiliki. */
  user_achievement_id: z.string().nullable(),
  awarded_at: z.number().int().nullable(),
  /** Border ini sedang dipakai (hanya reward_type profile_border). */
  is_active_border: z.boolean().optional(),
});

export const achievementItemResponseSchema = z.object({
  success: z.literal(true),
  data: achievementItemSchema,
});

export const achievementListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(achievementOwnershipSchema),
    next_cursor: z.string().nullable(),
  }),
});

export const achievementAdminListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      achievementItemSchema.extend({
        recipient_count: z.number().int(),
      }),
    ),
    next_cursor: z.string().nullable(),
  }),
});

export const achievementGrantResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    awarded: z.number().int(),
    skipped: z.number().int(),
    missing: z.array(z.string()),
  }),
});

export const achievementScanResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    scanned: z.number().int(),
    awarded: z.number().int(),
  }),
});

export const achievementPreviewResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    total: z.number().int(),
    sample: z.array(
      z.object({
        username: z.string(),
        display_name: z.string(),
        matched_at: z.string(),
      }),
    ),
  }),
});

/**
 * Daftar penerima (console revoke). `award_id` = user_achievements.id,
 * nilai yang dipakai `DELETE /admin/achievements/:id/awards/:awardId`.
 */
export const achievementRecipientsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(
      z.object({
        award_id: z.string().length(26),
        username: z.string(),
        display_name: z.string(),
        awarded_at: z.number().int(),
        granted_via: z.string(),
      }),
    ),
    next_cursor: z.string().nullable(),
  }),
});

export const achievementBorderResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    active_border_id: z.string().nullable(),
  }),
});
