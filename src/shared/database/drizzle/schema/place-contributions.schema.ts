import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';

export const placeContributions = sqliteTable(
  'place_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id').notNull(),
    placeId: text('place_id'),
    baseUpdatedAt: integer('base_updated_at', { mode: 'timestamp' }),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    /** Alasan penolakan (hanya saat status=rejected). */
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('place_contributions_user_status_idx').on(t.userId, t.status),
    index('place_contributions_place_status_idx').on(t.placeId, t.status),
    index('place_contributions_status_created_idx').on(t.status, t.createdAt),
  ],
);
