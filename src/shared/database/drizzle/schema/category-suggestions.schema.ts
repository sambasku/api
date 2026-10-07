import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

// Usulan kategori baru dari user (login ATAU anonim) - api#50. Semua usulan
// lewat moderasi reviewer; approve = INSERT ke master `categories`.
// Anonim: proposedBy NULL + contributorName terisi. Ter-link opsional ke
// word_suggestions (usulan kategori lahir dari form usul kata).
export const categorySuggestions = sqliteTable(
  'category_suggestions',
  {
    id: text('id').primaryKey().$defaultFn(() => generateId()),
    name: text('name').notNull(),
    reason: text('reason'),
    // 'pending' | 'approved' | 'rejected'
    status: text('status').notNull().default('pending'),
    proposedBy: text('proposed_by').references(() => users.id),
    contributorName: text('contributor_name'),
    wordSuggestionId: text('word_suggestion_id'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    rejectReason: text('reject_reason'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    // Satu nama aktif per status pending (cegah duplikat antrean);
    // nama rejected boleh diusulkan ulang.
    uniqueIndex('category_suggestions_pending_name_idx')
      .on(t.name)
      .where(sql`status = 'pending'`),
    index('category_suggestions_status_idx').on(t.status, t.createdAt),
  ],
);
