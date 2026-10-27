import { and, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { userRoles } from '@/shared/database/drizzle/schema';
import {
  achievements,
  comments,
  contributionReviews,
  contributions,
  examples,
  meanings,
  pronunciations,
  userAchievements,
  users,
  votes,
  wordAudios,
  wordImages,
  words,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { derivePrimaryRole } from '@/shared/utils/derive-primary-role';
import {
  IMPORT_POINT_FACTOR,
  POINT_WEIGHTS,
  SCARCITY_MULT_COMMON,
  SCARCITY_MULT_RARE,
  SCARCITY_MULT_UNCOMMON,
  SCARCITY_WORD_COUNT_RARE,
  SCARCITY_WORD_COUNT_UNCOMMON,
  buildLeveling,
} from '@/modules/leveling/domain/leveling';
import {
  STREAK_ACTIVITY_KINDS,
  STREAK_WINDOW_DAYS,
  computeStreakDays,
  wibDateKey,
} from '@/modules/leveling/domain/streak';
import type {
  MentionUserRow,
  PublicActivityItem,
  PublicActivityPage,
  PublicUserRow,
} from '../domain/entities/public-profile.entity';
import type {
  PublicProfileStatsBundle,
  PublicUserRepository,
} from '../domain/repositories/public-user.repository';

const ENTITY_LABEL: Record<string, string> = {
  word: 'Kata',
  meaning: 'Makna',
  pronunciation: 'Pelafalan',
  word_image: 'Gambar',
  word_audio: 'Audio',
  example: 'Contoh',
};

/** Param list aktivitas per kategori: keyset cursor ULID (id < cursor). */
interface RecentListParams {
  limit: number;
  cursor?: string;
}

/** Slice pasangan (id, item) (limit + 1) jadi halaman + keyset cursor. */
function toPage(
  rows: Array<{ id: string; item: PublicActivityItem }>,
  limit: number,
): PublicActivityPage {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map((row) => row.item),
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  };
}

/** Parse `json_group_array` hari aktif streak dari loadStats (1 kolom). */
function parseStreakDayKeys(raw: unknown): Set<string> {
  if (raw == null || raw === '') return new Set();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((x): x is string => typeof x === 'string' && x.length > 0),
    );
  } catch {
    return new Set();
  }
}

export class PublicUserRepositoryImpl implements PublicUserRepository {
  constructor(private readonly db: AppDatabase) {}

  async findPublicByUsername(username: string): Promise<PublicUserRow | null> {
    // LEFT JOIN border aktif: satu query, tanpa subrequest tambahan.
    // Border hanya tampil bila award masih ada (deleted_at null).
    const [row] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        joinedAt: users.createdAt,
        avatarUrl: users.avatarUrl,
        activeBorderUrl: achievements.badgeUrl,
      })
      .from(users)
      .leftJoin(userAchievements, eq(userAchievements.id, users.activeBorderId))
      .leftJoin(
        achievements,
        and(
          eq(achievements.id, userAchievements.achievementId),
          isNull(userAchievements.deletedAt),
          isNull(achievements.deletedAt),
        ),
      )
      .where(and(eq(users.username, username), isNull(users.deletedAt), eq(users.isActive, true)))
      .limit(1);
    if (!row) return null;
    const roles = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, row.id));
    const roleList = roles.map((r) => r.role);

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName || row.username,
      bio: row.bio ?? null,
      roles: roleList,
      role: derivePrimaryRole(roleList),
      joinedAt: row.joinedAt,
      avatarUrl: row.avatarUrl ?? null,
      activeBorderUrl: row.activeBorderUrl ?? null,
    };
  }

  /** Prefix-search username untuk autocomplete mention. Kolom publik saja. */
  async suggestByUsernamePrefix(prefix: string, limit: number): Promise<MentionUserRow[]> {
    // Range seek, bukan LIKE prefix||'%': LIKE tidak memakai index penuh
    // (scan setengah index + wildcard user harus di-escape). Charset
    // username `[a-z0-9._]` - '~' (0x7E) di atas 'z' (0x7A) = batas atas
    // aman, jadi `>= prefix AND < prefix~` persis prefix-match.
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          sql`${users.username} >= ${prefix}`,
          sql`${users.username} < ${`${prefix}~`}`,
          isNull(users.deletedAt),
          eq(users.isActive, true),
        ),
      )
      .orderBy(users.username)
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName || row.username,
      avatarUrl: row.avatarUrl ?? null,
    }));
  }

  async countApprovedContributions(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async loadStats(userId: string): Promise<PublicProfileStatsBundle> {
    if (userId === ANONIM_USER_ID) {
      return {
        contributionsApproved: 0,
        wordsApproved: 0,
        correctionsApproved: 0,
        verificationsDone: 0,
        commentsPublished: 0,
        leveling: buildLeveling({
          points: 0,
          exploration: 0,
          accuracy: 0,
          depth: 0,
          streakDays: 0,
        }),
      };
    }

    // 1 Turso execute: CROSS JOIN aggregate (1 scan/tabel) + streak JSON.
    // Bukan ~16 subquery skalar + query streak terpisah.
    const W = POINT_WEIGHTS;
    const half = IMPORT_POINT_FACTOR;
    const windowStartSec = Math.floor(
      (Date.now() - STREAK_WINDOW_DAYS * 24 * 3600 * 1000) / 1000,
    );
    const streakKindsSql = sql.join(
      STREAK_ACTIVITY_KINDS.map((k) => sql`${k}`),
      sql`, `,
    );

    const [row] = await this.db
      .select({
        wordsCount: sql<number>`contrib.words_count`.mapWith(Number),
        corrections: sql<number>`contrib.corrections`.mapWith(Number),
        depthCount: sql<number>`contrib.depth_count`.mapWith(Number),
        contributionPoints: sql<number>`contrib.contribution_points`.mapWith(
          Number,
        ),
        verificationsDone: sql<number>`rev.verifications_done`.mapWith(Number),
        verificationsNonSelf: sql<number>`rev.verifications_non_self`.mapWith(
          Number,
        ),
        verificationPoints: sql<number>`rev.verification_points`.mapWith(
          Number,
        ),
        commentsPublished: sql<number>`com.comments_published`.mapWith(Number),
        placeCount: sql<number>`plc.place_count`.mapWith(Number),
        usahaPoints: sql<number>`ush.usaha_points`.mapWith(Number),
        usahaNewCount: sql<number>`ush.usaha_new_count`.mapWith(Number),
        cuisinePoints: sql<number>`cul.cuisine_points`.mapWith(Number),
        cuisineNewCount: sql<number>`cul.cuisine_new_count`.mapWith(Number),
        eventCount: sql<number>`evt.event_count`.mapWith(Number),
        pantunCount: sql<number>`ptn.pantun_count`.mapWith(Number),
        voteReceivedPoints: sql<number>`vot.vote_received_points`.mapWith(
          Number,
        ),
        streakDayKeysJson: sql<string | null>`stk.streak_day_keys`,
      })
      .from(sql`(
        select 1
      ) as _dummy
      cross join (
        select
          coalesce(sum(case when c.entity_type = 'word' then 1 else 0 end), 0)
            as words_count,
          coalesce(sum(case when c.entity_type <> 'word' then 1 else 0 end), 0)
            as corrections,
          coalesce(sum(case when c.entity_type in (
            'meaning','example','pronunciation','word_image','word_audio'
          ) then 1 else 0 end), 0) as depth_count,
          coalesce(sum(
            (
              case c.entity_type
                when 'word' then case
                  when w_direct.id is null then 0
                  when w_direct.import_session_id is not null
                    then ${W.word * half} else ${W.word} end
                when 'meaning' then case when w_m.import_session_id is not null
                  then ${W.meaning * half} else ${W.meaning} end
                when 'example' then case when w_ex.import_session_id is not null
                  then ${W.example * half} else ${W.example} end
                when 'pronunciation' then case when w_p.import_session_id is not null
                  then ${W.pronunciation * half} else ${W.pronunciation} end
                when 'word_image' then case when w_i.import_session_id is not null
                  then ${W.word_image * half} else ${W.word_image} end
                when 'word_audio' then case when w_a.import_session_id is not null
                  then ${W.word_audio * half} else ${W.word_audio} end
                else 0
              end
            ) * (
              case
                when coalesce(lc.word_count, 999999) < ${SCARCITY_WORD_COUNT_RARE}
                  then ${SCARCITY_MULT_RARE}
                when coalesce(lc.word_count, 999999) < ${SCARCITY_WORD_COUNT_UNCOMMON}
                  then ${SCARCITY_MULT_UNCOMMON}
                else ${SCARCITY_MULT_COMMON}
              end
            )
          ), 0) as contribution_points
        from contributions c
        left join words as w_direct
          on c.entity_type = 'word' and c.entity_id = w_direct.id
        left join meanings as m
          on c.entity_type = 'meaning' and c.entity_id = m.id
        left join words as w_m on m.word_id = w_m.id
        left join examples as ex
          on c.entity_type = 'example' and c.entity_id = ex.id
        left join meanings as m_ex on ex.meaning_id = m_ex.id
        left join words as w_ex on m_ex.word_id = w_ex.id
        left join pronunciations as pr
          on c.entity_type = 'pronunciation' and c.entity_id = pr.id
        left join words as w_p on pr.word_id = w_p.id
        left join word_images as wi
          on c.entity_type = 'word_image' and c.entity_id = wi.id
        left join words as w_i on wi.word_id = w_i.id
        left join word_audios as wa
          on c.entity_type = 'word_audio' and c.entity_id = wa.id
        left join words as w_a on wa.word_id = w_a.id
        left join (
          select language_id, count(*) as word_count
          from words
          where deleted_at is null
          group by language_id
        ) as lc on lc.language_id = coalesce(
          w_direct.language_id, w_m.language_id, w_ex.language_id,
          w_p.language_id, w_i.language_id, w_a.language_id
        )
        where c.user_id = ${userId}
          and c.status in ('approved', 'corrected')
          and c.deleted_at is null
      ) as contrib
      cross join (
        select
          coalesce(count(*), 0) as verifications_done,
          coalesce(sum(case when c.user_id <> ${userId} then 1 else 0 end), 0)
            as verifications_non_self,
          coalesce(sum(case when c.user_id <> ${userId} then 1 else 0 end), 0)
            * ${W.verification} as verification_points
        from contribution_reviews cr
        inner join contributions c on cr.contribution_id = c.id
        where cr.reviewer_id = ${userId}
          and cr.status <> 'pending'
          and cr.deleted_at is null
      ) as rev
      cross join (
        select coalesce(count(*), 0) as comments_published
        from comments
        where user_id = ${userId}
          and status = 'published'
          and deleted_at is null
      ) as com
      cross join (
        select coalesce(count(*), 0) as place_count
        from place_contributions
        where user_id = ${userId} and status = 'approved'
      ) as plc
      cross join (
        select
          coalesce(sum(
            case when kind = 'new' then ${W.usaha} else ${W.data_edit} end
          ), 0) as usaha_points,
          coalesce(sum(case when kind = 'new' then 1 else 0 end), 0)
            as usaha_new_count
        from usaha_contributions
        where user_id = ${userId} and status = 'approved'
      ) as ush
      cross join (
        select
          coalesce(sum(
            case when kind in ('new_cuisine','new_place')
              then ${W.cuisine} else ${W.data_edit} end
          ), 0) as cuisine_points,
          coalesce(sum(
            case when kind in ('new_cuisine','new_place') then 1 else 0 end
          ), 0) as cuisine_new_count
        from culinary_contributions
        where user_id = ${userId} and status = 'approved'
      ) as cul
      cross join (
        select coalesce(count(*), 0) as event_count
        from event_contributions
        where user_id = ${userId} and status = 'approved'
      ) as evt
      cross join (
        select coalesce(count(*), 0) as pantun_count
        from pantuns
        where user_id = ${userId} and status = 'published'
      ) as ptn
      cross join (
        select coalesce(count(*), 0) * ${W.vote_received} as vote_received_points
        from votes v
        where v.value = 1
          and v.user_id <> ${userId}
          and (
            (
              v.entity_type = 'word'
              and exists (
                select 1 from words w
                where w.id = v.entity_id
                  and w.created_by = ${userId}
                  and w.deleted_at is null
              )
            )
            or (
              v.entity_type = 'meaning'
              and exists (
                select 1 from meanings m
                where m.id = v.entity_id
                  and m.created_by = ${userId}
                  and m.deleted_at is null
              )
            )
            or (
              v.entity_type = 'example'
              and exists (
                select 1 from examples e
                where e.id = v.entity_id
                  and e.created_by = ${userId}
                  and e.deleted_at is null
              )
            )
            or (
              v.entity_type = 'pronunciation'
              and exists (
                select 1 from pronunciations p
                where p.id = v.entity_id
                  and p.created_by = ${userId}
                  and p.deleted_at is null
              )
            )
            or (
              v.entity_type = 'word_image'
              and exists (
                select 1 from word_images wi
                where wi.id = v.entity_id
                  and wi.created_by = ${userId}
                  and wi.deleted_at is null
              )
            )
            or (
              v.entity_type = 'word_audio'
              and exists (
                select 1 from word_audios wa
                where wa.id = v.entity_id
                  and wa.created_by = ${userId}
                  and wa.deleted_at is null
              )
            )
            or (
              v.entity_type = 'comment'
              and exists (
                select 1 from comments cm
                where cm.id = v.entity_id
                  and cm.user_id = ${userId}
                  and cm.status = 'published'
                  and cm.deleted_at is null
              )
            )
            or (
              v.entity_type = 'pantun'
              and exists (
                select 1 from pantuns pn
                where pn.id = v.entity_id
                  and pn.user_id = ${userId}
                  and pn.status = 'published'
              )
            )
          )
      ) as vot
      cross join (
        select coalesce((
          select json_group_array(day_key)
          from (
            select distinct
              date(occurred_at, 'unixepoch', '+7 hours') as day_key
            from activity_events
            where actor_id = ${userId}
              and hidden_at is null
              and occurred_at >= ${windowStartSec}
              and kind in (${streakKindsSql})
          )
        ), '[]') as streak_day_keys
      ) as stk`);

    const wordsCount = row?.wordsCount ?? 0;
    const corrections = row?.corrections ?? 0;
    const verificationsDone = row?.verificationsDone ?? 0;
    const verificationsNonSelf = row?.verificationsNonSelf ?? 0;
    const placeCount = row?.placeCount ?? 0;
    const eventCount = row?.eventCount ?? 0;
    const pantunCount = row?.pantunCount ?? 0;
    const points =
      (row?.contributionPoints ?? 0) +
      (row?.verificationPoints ?? 0) +
      (row?.voteReceivedPoints ?? 0) +
      placeCount * W.place +
      (row?.usahaPoints ?? 0) +
      (row?.cuisinePoints ?? 0) +
      eventCount * W.event +
      pantunCount * W.pantun;
    const exploration =
      wordsCount +
      placeCount +
      (row?.usahaNewCount ?? 0) +
      (row?.cuisineNewCount ?? 0) +
      eventCount +
      pantunCount;
    const streakDays = computeStreakDays(
      parseStreakDayKeys(row?.streakDayKeysJson),
      wibDateKey(Date.now()),
    );

    return {
      contributionsApproved: wordsCount + corrections,
      wordsApproved: wordsCount,
      correctionsApproved: corrections,
      verificationsDone,
      commentsPublished: row?.commentsPublished ?? 0,
      leveling: buildLeveling({
        points,
        exploration,
        accuracy: verificationsNonSelf + corrections,
        depth: row?.depthCount ?? 0,
        streakDays,
      }),
    };
  }

  async listRecentApprovedContributions(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    // limit + 1 = deteksi hasMore tanpa count terpisah.
    const rows = await this.db
      .select({
        id: contributions.id,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
        createdAt: contributions.createdAt,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.userId, userId),
          inArray(contributions.status, ['approved', 'corrected']),
          isNull(contributions.deletedAt),
          cursor ? lt(contributions.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(contributions.id))
      .limit(limit + 1);

    const resolved = await this.resolveContributionParents(rows);
    return toPage(
      rows.map((row) => {
        const parent = resolved.get(`${row.entityType}:${row.entityId}`);
        const label = ENTITY_LABEL[row.entityType] ?? row.entityType;
        const lemma = parent?.lemma ?? null;
        return {
          id: row.id,
          item: {
            kind: 'contribution' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: parent?.wordId ?? null,
            lemma,
            summary: lemma ? `${label}: ${lemma}` : label,
          },
        };
      }),
      limit,
    );
  }

  async listRecentPublishedComments(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        wordId: comments.wordId,
        createdAt: comments.createdAt,
        lemma: words.lemma,
      })
      .from(comments)
      .innerJoin(words, eq(comments.wordId, words.id))
      .where(
        and(
          eq(comments.userId, userId),
          eq(comments.status, 'published'),
          isNull(comments.deletedAt),
          cursor ? lt(comments.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(comments.id))
      .limit(limit + 1);

    return toPage(
      rows.map((row) => {
        const snippet =
          row.body.length > 120 ? `${row.body.slice(0, 117)}…` : row.body;
        return {
          id: row.id,
          item: {
            kind: 'comment' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: row.wordId,
            lemma: row.lemma,
            summary: snippet,
          },
        };
      }),
      limit,
    );
  }

  async listRecentVerifications(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    const rows = await this.db
      .select({
        id: contributionReviews.id,
        createdAt: contributionReviews.createdAt,
        entityType: contributions.entityType,
        entityId: contributions.entityId,
      })
      .from(contributionReviews)
      .innerJoin(contributions, eq(contributionReviews.contributionId, contributions.id))
      .where(
        and(
          eq(contributionReviews.reviewerId, userId),
          ne(contributionReviews.status, 'pending'),
          isNull(contributionReviews.deletedAt),
          cursor ? lt(contributionReviews.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(contributionReviews.id))
      .limit(limit + 1);

    const resolved = await this.resolveContributionParents(rows);
    return toPage(
      rows.map((row) => {
        const parent = resolved.get(`${row.entityType}:${row.entityId}`);
        const label = ENTITY_LABEL[row.entityType] ?? row.entityType;
        const lemma = parent?.lemma ?? null;
        return {
          id: row.id,
          item: {
            kind: 'verification' as const,
            id: row.id,
            occurredAt: row.createdAt,
            wordId: parent?.wordId ?? null,
            lemma,
            summary: lemma
              ? `Memverifikasi ${label}: ${lemma}`
              : `Memverifikasi ${label}`,
          },
        };
      }),
      limit,
    );
  }

  async listRecentVotes(
    userId: string,
    { limit, cursor }: RecentListParams,
  ): Promise<PublicActivityPage> {
    // Vote publik user, hanya target bersistem kata (word/comment) yang
    // katanya masih feed-visible: navigasi tetap menuju halaman kata.
    // Target lain (discussion, discussion_reply) tidak punya lemma - dibuang.
    // ponytail: dua query terpisah (vote word vs vote comment) lalu merge -
    // target polymorphic tanpa FK tidak bisa satu FROM bersih.
    // Upgrade: kolom word_id denormalized di votes.
    const select = {
      id: votes.id,
      value: votes.value,
      updatedAt: votes.updatedAt,
      createdAt: votes.createdAt,
      lemma: words.lemma,
      wordId: words.id,
    };

    const wordVotes = await this.db
      .select(select)
      .from(votes)
      .innerJoin(
        words,
        and(eq(votes.entityType, 'word'), eq(words.id, votes.entityId)),
      )
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.entityType, 'word'),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          cursor ? lt(votes.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(votes.id))
      .limit(limit + 1);

    const commentVotes = await this.db
      .select(select)
      .from(votes)
      .innerJoin(
        comments,
        and(eq(votes.entityType, 'comment'), eq(comments.id, votes.entityId)),
      )
      .innerJoin(words, eq(words.id, comments.wordId))
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.entityType, 'comment'),
          isNull(words.deletedAt),
          eq(words.status, 'published'),
          cursor ? lt(votes.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(votes.id))
      .limit(limit + 1);

    // Merge dua sumber id-desc, tetap keyset by id (ULID monotonic = urut waktu).
    const merged = [...wordVotes, ...commentVotes]
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, limit + 1);

    return toPage(
      merged.map((row) => {
        const quoted = `"${row.lemma}"`;
        // Copy identik dengan feed beranda: mobile membaca arah vote dari
        // akhiran body ("perlu dicek ulang" = down, selain itu up).
        return {
          id: row.id,
          item: {
            kind: 'vote' as const,
            id: row.id,
            occurredAt: row.updatedAt ?? row.createdAt,
            wordId: row.wordId,
            lemma: row.lemma,
            summary:
              row.value >= 0
                ? `${quoted} sudah pas`
                : `${quoted} perlu dicek ulang`,
          },
        };
      }),
      limit,
    );
  }

  private async resolveContributionParents(
    items: Array<{ entityType: string; entityId: string }>,
  ): Promise<Map<string, { lemma: string; wordId: string }>> {
    const out = new Map<string, { lemma: string; wordId: string }>();
    if (items.length === 0) return out;

    const idsOf = (type: string) =>
      items.filter((i) => i.entityType === type).map((i) => i.entityId);

    const wordIds = idsOf('word');
    if (wordIds.length > 0) {
      const rows = await this.db
        .select({ id: words.id, lemma: words.lemma })
        .from(words)
        .where(inArray(words.id, wordIds));
      for (const r of rows) out.set(`word:${r.id}`, { lemma: r.lemma, wordId: r.id });
    }

    const pronIds = idsOf('pronunciation');
    if (pronIds.length > 0) {
      const rows = await this.db
        .select({ id: pronunciations.id, lemma: words.lemma, wordId: pronunciations.wordId })
        .from(pronunciations)
        .innerJoin(words, eq(pronunciations.wordId, words.id))
        .where(inArray(pronunciations.id, pronIds));
      for (const r of rows)
        out.set(`pronunciation:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const imageIds = idsOf('word_image');
    if (imageIds.length > 0) {
      const rows = await this.db
        .select({ id: wordImages.id, lemma: words.lemma, wordId: wordImages.wordId })
        .from(wordImages)
        .innerJoin(words, eq(wordImages.wordId, words.id))
        .where(inArray(wordImages.id, imageIds));
      for (const r of rows)
        out.set(`word_image:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const audioIds = idsOf('word_audio');
    if (audioIds.length > 0) {
      const rows = await this.db
        .select({ id: wordAudios.id, lemma: words.lemma, wordId: wordAudios.wordId })
        .from(wordAudios)
        .innerJoin(words, eq(wordAudios.wordId, words.id))
        .where(inArray(wordAudios.id, audioIds));
      for (const r of rows)
        out.set(`word_audio:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const meaningIds = idsOf('meaning');
    if (meaningIds.length > 0) {
      const rows = await this.db
        .select({ id: meanings.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(meanings)
        .innerJoin(words, eq(meanings.wordId, words.id))
        .where(inArray(meanings.id, meaningIds));
      for (const r of rows)
        out.set(`meaning:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    const exampleIds = idsOf('example');
    if (exampleIds.length > 0) {
      const rows = await this.db
        .select({ id: examples.id, lemma: words.lemma, wordId: meanings.wordId })
        .from(examples)
        .innerJoin(meanings, eq(examples.meaningId, meanings.id))
        .innerJoin(words, eq(meanings.wordId, words.id))
        .where(inArray(examples.id, exampleIds));
      for (const r of rows)
        out.set(`example:${r.id}`, { lemma: r.lemma, wordId: r.wordId });
    }

    return out;
  }
}
