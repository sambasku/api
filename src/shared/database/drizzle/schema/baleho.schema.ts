import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

export const BALEHO_COLS = 4;
export const BALEHO_ROWS = 6;
/** Sisi panjang max (landscape 4x2 / portrait 2x4). */
export const BALEHO_MAX_LONG = 4;
/** Sisi pendek max - salah satu sisi wajib ≤ ini. */
export const BALEHO_MAX_SHORT = 2;
/** Alias: loop/clamp per sumbu boleh sampai sisi panjang. */
export const BALEHO_MAX_W = BALEHO_MAX_LONG;
export const BALEHO_MAX_H = BALEHO_MAX_LONG;

/** True untuk 1x1..4x2 (landscape) dan 1x3..2x4 (portrait); tolak 3x3+. */
export function isValidBalehoSize(w: number, h: number): boolean {
  if (!Number.isInteger(w) || !Number.isInteger(h)) return false;
  if (w < 1 || h < 1) return false;
  if (w > BALEHO_MAX_LONG || h > BALEHO_MAX_LONG) return false;
  return Math.min(w, h) <= BALEHO_MAX_SHORT;
}
export const BALEHO_MAX_ACTIVE_PER_USER = 2;
export const BALEHO_MAX_DAYS = 30;
export const BALEHO_PAYMENT_TIMEOUT_MS = 48 * 60 * 60 * 1000;

export const BALEHO_CREATIVE_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;
export type BalehoCreativeStatus = (typeof BALEHO_CREATIVE_STATUSES)[number];

export const BALEHO_PLACEMENT_STATUSES = [
  'pending_review',
  'awaiting_payment',
  'live',
  'paused',
  'rejected',
  'cancelled',
  'expired',
] as const;
export type BalehoPlacementStatus = (typeof BALEHO_PLACEMENT_STATUSES)[number];

/** Status yang mengunci sel di occupancy (paused tetap pegang slot). */
export const BALEHO_LOCKING_STATUSES: readonly BalehoPlacementStatus[] = [
  'pending_review',
  'awaiting_payment',
  'live',
  'paused',
];

export const BALEHO_MEDIA_TYPES = ['image', 'video', 'text_cta'] as const;
export type BalehoMediaType = (typeof BALEHO_MEDIA_TYPES)[number];

export const BALEHO_ACTION_TYPES = ['in_app', 'external'] as const;
export type BalehoActionType = (typeof BALEHO_ACTION_TYPES)[number];

export const BALEHO_COMMISSION_STATUSES = ['unclaimed', 'claimed'] as const;
export type BalehoCommissionStatus =
  (typeof BALEHO_COMMISSION_STATUSES)[number];

export const BALEHO_EVENT_TYPES = [
  'impression',
  'tap',
  'action',
  'action_success',
  'action_fail',
] as const;
export type BalehoEventType = (typeof BALEHO_EVENT_TYPES)[number];

export const BALEHO_ENTITY_TYPES = [
  'place',
  'event',
  'usaha',
  'karya',
] as const;
export type BalehoEntityType = (typeof BALEHO_ENTITY_TYPES)[number];

export const balehoCreatives = sqliteTable(
  'baleho_creatives',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    fingerprint: text('fingerprint').notNull(),
    moderationStatus: text('moderation_status')
      .notNull()
      .default('pending')
      .$type<BalehoCreativeStatus>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('baleho_creatives_owner_idx').on(t.ownerUserId),
    index('baleho_creatives_fingerprint_idx').on(t.ownerUserId, t.fingerprint),
  ],
);

export const balehoFrames = sqliteTable(
  'baleho_frames',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    creativeId: text('creative_id')
      .notNull()
      .references(() => balehoCreatives.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    mediaType: text('media_type').notNull().$type<BalehoMediaType>(),
    mediaUrl: text('media_url'),
    title: text('title'),
    /** Teks body sheet (maks 320 di validator). */
    body: text('body'),
    ctaLabel: text('cta_label'),
    actionType: text('action_type').notNull().$type<BalehoActionType>(),
    actionPayload: text('action_payload').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('baleho_frames_creative_sort_idx').on(t.creativeId, t.sortOrder),
  ],
);

export const balehoPlacements = sqliteTable(
  'baleho_placements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    creativeId: text('creative_id')
      .notNull()
      .references(() => balehoCreatives.id),
    slide: integer('slide').notNull(),
    col: integer('col').notNull(),
    row: integer('row').notNull(),
    w: integer('w').notNull(),
    h: integer('h').notNull(),
    status: text('status')
      .notNull()
      .default('pending_review')
      .$type<BalehoPlacementStatus>(),
    advertiserUserId: text('advertiser_user_id')
      .notNull()
      .references(() => users.id),
    referrerUserId: text('referrer_user_id').references(() => users.id),
    referralUsername: text('referral_username'),
    entityType: text('entity_type').$type<BalehoEntityType>(),
    entityId: text('entity_id'),
    startsAt: integer('starts_at', { mode: 'timestamp' }),
    endsAt: integer('ends_at', { mode: 'timestamp' }),
    /** Hari mulai tayang yang dipilih saat pesan (00:00 WIB). */
    scheduledStartsOn: integer('scheduled_starts_on', { mode: 'timestamp' }),
    /** Nomor WA konfirmasi (digit internasional 62/60). */
    confirmationPhone: text('confirmation_phone'),
    /** Sudah dikirim notif H-1 (1x). Epoch ms. */
    endingSoonNotifiedAt: integer('ending_soon_notified_at', {
      mode: 'timestamp',
    }),
    /** Lama booking (hari) saat pesan. */
    days: integer('days'),
    /** Snapshot tarif IDR per sel 1x1 per hari saat pesan. */
    pricePerCellPerDay: integer('price_per_cell_per_day'),
    /** Snapshot total = w * h * days * price_per_cell_per_day. */
    quotedAmount: integer('quoted_amount'),
    awaitingPaymentAt: integer('awaiting_payment_at', { mode: 'timestamp' }),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    /** URL bukti transfer di ImageKit (wajib saat mark-paid). */
    paymentProofUrl: text('payment_proof_url'),
    /** File id ImageKit untuk bukti (hapus/audit). */
    paymentProofFileId: text('payment_proof_file_id'),
    rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
    rejectReason: text('reject_reason'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('baleho_placements_slide_status_idx').on(t.slide, t.status),
    index('baleho_placements_advertiser_status_idx').on(
      t.advertiserUserId,
      t.status,
    ),
    index('baleho_placements_referrer_idx').on(t.referrerUserId),
  ],
);

export const balehoOccupancy = sqliteTable(
  'baleho_occupancy',
  {
    slide: integer('slide').notNull(),
    col: integer('col').notNull(),
    row: integer('row').notNull(),
    placementId: text('placement_id')
      .notNull()
      .references(() => balehoPlacements.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('baleho_occupancy_cell_placement_uq').on(
      t.slide,
      t.col,
      t.row,
      t.placementId,
    ),
    index('baleho_occupancy_placement_idx').on(t.placementId),
  ],
);

export const balehoCommissions = sqliteTable(
  'baleho_commissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    placementId: text('placement_id')
      .notNull()
      .references(() => balehoPlacements.id),
    referrerUserId: text('referrer_user_id')
      .notNull()
      .references(() => users.id),
    amount: integer('amount').notNull().default(0),
    currency: text('currency').notNull().default('IDR'),
    status: text('status')
      .notNull()
      .default('unclaimed')
      .$type<BalehoCommissionStatus>(),
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('baleho_commissions_placement_uidx').on(t.placementId),
    index('baleho_commissions_referrer_status_idx').on(
      t.referrerUserId,
      t.status,
    ),
  ],
);

export const balehoEvents = sqliteTable(
  'baleho_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    placementId: text('placement_id')
      .notNull()
      .references(() => balehoPlacements.id, { onDelete: 'cascade' }),
    frameId: text('frame_id').references(() => balehoFrames.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').notNull().$type<BalehoEventType>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('baleho_events_placement_type_idx').on(t.placementId, t.eventType),
    index('baleho_events_created_idx').on(t.createdAt),
  ],
);
