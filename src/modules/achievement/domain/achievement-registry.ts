import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { comments } from '@/shared/database/drizzle/schema/comments.schema';
import { contributionReviews } from '@/shared/database/drizzle/schema/contribution-reviews.schema';
import { contributions } from '@/shared/database/drizzle/schema/contributions.schema';
import {
  discussionReplies,
  discussions,
} from '@/shared/database/drizzle/schema/discussions.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import type { AchievementCriteria } from './entities/achievement.entity';

/**
 * Registry source achievement - SATU-SATUNYA tempat sumber kriteria
 * didaftarkan.
 *
 * Dual-mode evaluator (ACHIEVEMENT_ENHANCEMENT Q3 / B2):
 * - `user_match`: boolean pada baris `users` (kohort registration).
 * - `aggregate`: GROUP BY user HAVING COUNT(*) >= threshold.
 *
 * `aggregateFact` menunjuk tabel fakta untuk cabang repository.
 */

export type AchievementEvaluatorKind = 'user_match' | 'aggregate';

/** Tabel fakta yang didukung mesin agregat. */
export type AchievementAggregateFact =
  | 'contributions'
  | 'contribution_reviews'
  | 'comments'
  | 'discussions'
  | 'discussion_replies';

export interface AchievementFilterField {
  key: string;
  label: string;
  options?: string[];
}

export interface AchievementSourceDefinition {
  source: string;
  label: string;
  description: string;
  kind: AchievementEvaluatorKind;
  supportsThreshold: boolean;
  supportsWindow: boolean;
  filterFields: AchievementFilterField[];
  manualOnly?: boolean;
  /** Wajib untuk kind=aggregate. */
  aggregateFact?: AchievementAggregateFact;
  buildMatch?(criteria: AchievementCriteria): SQL;
  buildAggregateFilters?(criteria: AchievementCriteria): SQL[];
}

function parseWindowBound(value: string, field: 'from' | 'to'): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Window ${field} bukan tanggal valid: ${value}`);
  }
  return parsed;
}

function windowOn(
  criteria: AchievementCriteria,
  column: { name?: string } & object,
): SQL[] {
  const out: SQL[] = [];
  const from = criteria.window?.from;
  const to = criteria.window?.to;
  if (from) out.push(gte(column as never, parseWindowBound(from, 'from')));
  if (to) out.push(lt(column as never, parseWindowBound(to, 'to')));
  return out;
}

const registrationSource: AchievementSourceDefinition = {
  source: 'registration',
  label: 'Kohort pendaftaran',
  description: 'Pengguna yang terdaftar dalam rentang tanggal tertentu.',
  kind: 'user_match',
  supportsThreshold: false,
  supportsWindow: true,
  filterFields: [],
  buildMatch(criteria: AchievementCriteria): SQL {
    const from = criteria.window?.from;
    const to = criteria.window?.to;
    if (!from || !to) return sql`1 = 1`;
    return and(
      gte(users.createdAt, parseWindowBound(from, 'from')),
      lt(users.createdAt, parseWindowBound(to, 'to')),
    )!;
  },
};

const manualSource: AchievementSourceDefinition = {
  source: 'manual',
  label: 'Manual (admin)',
  description: 'Diberikan langsung oleh admin, tanpa kondisi otomatis.',
  kind: 'user_match',
  supportsThreshold: false,
  supportsWindow: false,
  filterFields: [],
  manualOnly: true,
  buildMatch(): SQL {
    return sql`1 = 0`;
  },
};

export const CONTRIBUTION_ENTITY_TYPE_OPTIONS = [
  'word',
  'pronunciation',
  'word_image',
  'word_audio',
  'example',
  'meaning',
] as const;

const contributionsApprovedSource: AchievementSourceDefinition = {
  source: 'contributions_approved',
  label: 'Kontribusi disetujui',
  description:
    'Jumlah kontribusi berstatus approved/corrected (boleh filter jenis entity).',
  kind: 'aggregate',
  aggregateFact: 'contributions',
  supportsThreshold: true,
  supportsWindow: true,
  filterFields: [
    {
      key: 'entity_type',
      label: 'Jenis kontribusi',
      options: [...CONTRIBUTION_ENTITY_TYPE_OPTIONS],
    },
  ],
  buildAggregateFilters(criteria: AchievementCriteria): SQL[] {
    const filters: SQL[] = [...windowOn(criteria, contributions.createdAt)];
    const entityType = criteria.filters?.entity_type;
    if (entityType) filters.push(eq(contributions.entityType, entityType));
    return filters;
  },
};

/** Keputusan review non-pending per reviewer (bukan pending antrean). */
const verificationsDoneSource: AchievementSourceDefinition = {
  source: 'verifications_done',
  label: 'Verifikasi dilakukan',
  description: 'Jumlah keputusan review (approved/rejected/corrected) oleh reviewer.',
  kind: 'aggregate',
  aggregateFact: 'contribution_reviews',
  supportsThreshold: true,
  supportsWindow: true,
  filterFields: [],
  buildAggregateFilters(criteria: AchievementCriteria): SQL[] {
    return windowOn(criteria, contributionReviews.createdAt);
  },
};

const commentsPublishedSource: AchievementSourceDefinition = {
  source: 'comments_published',
  label: 'Komentar tayang',
  description: 'Jumlah komentar berstatus published (bukan takedown / hapus penulis).',
  kind: 'aggregate',
  aggregateFact: 'comments',
  supportsThreshold: true,
  supportsWindow: true,
  filterFields: [],
  buildAggregateFilters(criteria: AchievementCriteria): SQL[] {
    return windowOn(criteria, comments.createdAt);
  },
};

const discussionsCreatedSource: AchievementSourceDefinition = {
  source: 'discussions_created',
  label: 'Diskusi disetujui',
  description: 'Jumlah ruang diskusi berstatus published milik user.',
  kind: 'aggregate',
  aggregateFact: 'discussions',
  supportsThreshold: true,
  supportsWindow: true,
  filterFields: [],
  buildAggregateFilters(criteria: AchievementCriteria): SQL[] {
    return windowOn(criteria, discussions.createdAt);
  },
};

const discussionRepliesPublishedSource: AchievementSourceDefinition = {
  source: 'discussion_replies_published',
  label: 'Balasan diskusi tayang',
  description: 'Jumlah balasan diskusi berstatus published.',
  kind: 'aggregate',
  aggregateFact: 'discussion_replies',
  supportsThreshold: true,
  supportsWindow: true,
  filterFields: [],
  buildAggregateFilters(criteria: AchievementCriteria): SQL[] {
    return windowOn(criteria, discussionReplies.createdAt);
  },
};

export const ACHIEVEMENT_SOURCE_REGISTRY: Record<string, AchievementSourceDefinition> = {
  registration: registrationSource,
  manual: manualSource,
  contributions_approved: contributionsApprovedSource,
  verifications_done: verificationsDoneSource,
  comments_published: commentsPublishedSource,
  discussions_created: discussionsCreatedSource,
  discussion_replies_published: discussionRepliesPublishedSource,
};

export const ACHIEVEMENT_SELECTABLE_SOURCES: AchievementSourceDefinition[] =
  Object.values(ACHIEVEMENT_SOURCE_REGISTRY);

export function findAchievementSource(source: string): AchievementSourceDefinition | null {
  return ACHIEVEMENT_SOURCE_REGISTRY[source] ?? null;
}

export function isAchievementSourceKnown(source: string): boolean {
  return source in ACHIEVEMENT_SOURCE_REGISTRY;
}

export function effectiveAggregateThreshold(criteria: AchievementCriteria): number {
  const t = criteria.threshold;
  if (t == null || t < 1) return 1;
  return t;
}

export const ACHIEVEMENT_CONTRIBUTION_STATUSES = ['approved', 'corrected'] as const;

export function contributionStatusInApproved(): SQL {
  return inArray(contributions.status, [...ACHIEVEMENT_CONTRIBUTION_STATUSES]);
}

/** Base WHERE fakta (tanpa window/filter source) - dipakai scan + progress. */
export function aggregateFactBaseWhere(fact: AchievementAggregateFact): SQL[] {
  switch (fact) {
    case 'contributions':
      return [contributionStatusInApproved(), isNull(contributions.deletedAt)];
    case 'contribution_reviews':
      return [
        ne(contributionReviews.status, 'pending'),
        isNotNull(contributionReviews.reviewerId),
        isNull(contributionReviews.deletedAt),
      ];
    case 'comments':
      return [eq(comments.status, 'published'), isNull(comments.deletedAt)];
    case 'discussions':
      return [eq(discussions.status, 'published')];
    case 'discussion_replies':
      return [eq(discussionReplies.status, 'published')];
  }
}

/** Signature criteria untuk dedupe progress (abaikan threshold). */
export function criteriaProgressSignature(criteria: AchievementCriteria): string {
  return JSON.stringify({
    source: criteria.source,
    window: criteria.window ?? null,
    filters: criteria.filters ?? null,
  });
}
