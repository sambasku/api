import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { communityOrgs } from './community-orgs.schema';
import { kategoriKomunitas } from './kategori-komunitas.schema';

export const COMMUNITY_PROPOSAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type CommunityProposalStatus =
  (typeof COMMUNITY_PROPOSAL_STATUSES)[number];

/**
 * Usulan komunitas baru.
 * `category_id` → master `kategori_komunitas` (default `lain`).
 */
export const communityProposals = sqliteTable(
  'community_proposals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    logoUrl: text('logo_url'),
    categoryId: text('category_id')
      .notNull()
      .default('lain')
      .references(() => kategoriKomunitas.id),
    status: text('status', { enum: COMMUNITY_PROPOSAL_STATUSES })
      .notNull()
      .default('pending'),
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    communityOrgId: text('community_org_id').references(() => communityOrgs.id),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('community_proposals_user_status_idx').on(t.userId, t.status),
    index('community_proposals_status_created_idx').on(t.status, t.createdAt),
  ],
);
