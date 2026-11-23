import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ugcCommentLemmaLinks, words } from '@/shared/database/drizzle/schema';
import type {
  UgcCommentAnchorKind,
  UgcCommentLemmaLinkSource,
  UgcCommentLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
const proposedWords = alias(words, 'ugc_comment_lemma_proposed_words');
import type { UgcCommentLemmaLink } from '../domain/entities/ugc-comment-lemma.entity';
import type { UgcCommentLemmaRepository } from '../domain/repositories/ugc-comment-lemma.repository';

function mapRow(row: {
  link: typeof ugcCommentLemmaLinks.$inferSelect;
  lemma: string | null;
  proposedLemma: string | null;
}): UgcCommentLemmaLink {
  return {
    id: row.link.id,
    anchorKind: row.link.anchorKind,
    hostId: row.link.hostId,
    commentId: row.link.commentId,
    start: row.link.start,
    end: row.link.end,
    wordId: row.link.wordId,
    lemma: row.lemma,
    status: row.link.status,
    source: row.link.source,
    proposedWordId: row.link.proposedWordId,
    proposedLemma: row.proposedLemma,
    proposedBy: row.link.proposedBy,
    createdAt: row.link.createdAt,
    updatedAt: row.link.updatedAt,
  };
}

const ACTIVE = sql`${ugcCommentLemmaLinks.status} in ('active', 'pending_correction')`;

export class UgcCommentLemmaRepositoryImpl implements UgcCommentLemmaRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    anchorKind: UgcCommentAnchorKind;
    hostId: string;
    commentId: string;
    start: number;
    end: number;
    wordId: string;
    source: UgcCommentLemmaLinkSource;
  }): Promise<UgcCommentLemmaLink> {
    const [row] = await this.db
      .insert(ugcCommentLemmaLinks)
      .values({
        anchorKind: input.anchorKind,
        hostId: input.hostId,
        commentId: input.commentId,
        start: input.start,
        end: input.end,
        wordId: input.wordId,
        source: input.source,
        status: 'active',
      })
      .returning({ id: ugcCommentLemmaLinks.id });
    const created = await this.findById(row.id);
    if (!created) throw new Error('ugc comment lemma link missing after insert');
    return created;
  }

  async findById(id: string): Promise<UgcCommentLemmaLink | null> {
    const rows = await this.db
      .select({
        link: ugcCommentLemmaLinks,
        lemma: words.lemma,
        proposedLemma: proposedWords.lemma,
      })
      .from(ugcCommentLemmaLinks)
      .leftJoin(words, eq(words.id, ugcCommentLemmaLinks.wordId))
      .leftJoin(
        proposedWords,
        eq(proposedWords.id, ugcCommentLemmaLinks.proposedWordId),
      )
      .where(eq(ugcCommentLemmaLinks.id, id))
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async listActiveForComment(
    anchorKind: UgcCommentAnchorKind,
    commentId: string,
  ): Promise<UgcCommentLemmaLink[]> {
    return this.listActiveForComments(anchorKind, [commentId]);
  }

  async listActiveForComments(
    anchorKind: UgcCommentAnchorKind,
    commentIds: string[],
  ): Promise<UgcCommentLemmaLink[]> {
    if (commentIds.length === 0) return [];
    const rows = await this.db
      .select({
        link: ugcCommentLemmaLinks,
        lemma: words.lemma,
        proposedLemma: proposedWords.lemma,
      })
      .from(ugcCommentLemmaLinks)
      .leftJoin(words, eq(words.id, ugcCommentLemmaLinks.wordId))
      .leftJoin(
        proposedWords,
        eq(proposedWords.id, ugcCommentLemmaLinks.proposedWordId),
      )
      .where(
        and(
          eq(ugcCommentLemmaLinks.anchorKind, anchorKind),
          inArray(ugcCommentLemmaLinks.commentId, commentIds),
          ACTIVE,
        ),
      )
      .orderBy(asc(ugcCommentLemmaLinks.commentId), asc(ugcCommentLemmaLinks.start));
    return rows.map(mapRow);
  }

  async deleteById(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(ugcCommentLemmaLinks)
      .where(eq(ugcCommentLemmaLinks.id, id))
      .returning({ id: ugcCommentLemmaLinks.id });
    return deleted.length > 0;
  }

  async markStaleForComment(
    anchorKind: UgcCommentAnchorKind,
    commentId: string,
  ): Promise<number> {
    const updated = await this.db
      .update(ugcCommentLemmaLinks)
      .set({
        status: 'stale' satisfies UgcCommentLemmaLinkStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ugcCommentLemmaLinks.anchorKind, anchorKind),
          eq(ugcCommentLemmaLinks.commentId, commentId),
          ACTIVE,
        ),
      )
      .returning({ id: ugcCommentLemmaLinks.id });
    return updated.length;
  }
}