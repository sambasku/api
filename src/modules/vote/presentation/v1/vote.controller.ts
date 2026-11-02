import type { Context } from 'hono';
import { logger } from '@/shared/logging/logger';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { ToggleVoteUseCase } from '../../application/use-cases/toggle-vote.use-case';
import type { GetVoteCountsUseCase } from '../../application/use-cases/get-vote-counts.use-case';
import type { GetMyVotesUseCase } from '../../application/use-cases/get-my-votes.use-case';
import type { ListMyVoteHistoryUseCase } from '../../application/use-cases/list-my-vote-history.use-case';
import type { GetVoteDeckUseCase } from '../../application/use-cases/get-vote-deck.use-case';
import type { SkipVoteDeckWordUseCase } from '../../application/use-cases/skip-vote-deck-word.use-case';
import type { VoteTarget } from '../../domain/repositories/vote.repository';
import type { SkipVoteDeckBody, ToggleVoteBody, VoteDeckQuery, VoteHistoryQuery } from './validators/vote.validator';

// Semua role boleh vote (08-api-upvote-downvote.md) - tidak ada gate role
// di controller; 401 sudah ditangani middleware authenticate.
export class VoteController {
  constructor(
    private readonly deps: {
      toggle: ToggleVoteUseCase;
      counts: GetVoteCountsUseCase;
      myVotes: GetMyVotesUseCase;
      history: ListMyVoteHistoryUseCase;
      deck: GetVoteDeckUseCase;
      skipDeck: SkipVoteDeckWordUseCase;
    },
  ) {}

  /** POST /api/v1/votes - toggle upvote/downvote */
  async toggle(c: Context, body: ToggleVoteBody) {
    const user = this.requireUser(c);
    const result = await this.deps.toggle.execute({
      userId: user.user_id,
      targetType: body.target_type,
      targetId: body.target_id,
      value: body.value,
      clientId: user.azp ?? null,
    });

    logger.info(
      { request_id: this.requestId(c), target_type: body.target_type, target_id: body.target_id, my_vote: result.myVote },
      'vote toggled',
    );

    // 52: wire pakai target efektif (word→meaning), bukan body mentah.
    return c.json({
      success: true as const,
      data: {
        target_type: result.targetType,
        target_id: result.targetId,
        my_vote: result.myVote,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
      },
    });
  }

  /** GET /api/v1/votes/counts?targets=... - batch counts (publik) */
  async counts(c: Context, query: { targets: VoteTarget[] }) {
    const items = await this.deps.counts.execute(query.targets);
    return c.json({
      success: true as const,
      data: items.map((i) => ({
        target_type: i.targetType,
        target_id: i.targetId,
        upvotes: i.upvotes,
        downvotes: i.downvotes,
      })),
    });
  }

  /** GET /api/v1/votes/history - riwayat vote milik user login */
  async history(c: Context, query: VoteHistoryQuery) {
    const user = this.requireUser(c);
    const page = await this.deps.history.execute(user.user_id, {
      limit: query.limit,
      cursor: query.cursor,
      targetType: query.target_type,
      value: query.value === '1' ? 1 : query.value === '-1' ? -1 : undefined,
    });
    return c.json({
      success: true as const,
      data: page.items.map((item) => ({
        id: item.id,
        target_type: item.entityType,
        target_id: item.entityId,
        value: item.value,
        voted_at: item.votedAt.toISOString(),
        word: item.word
          ? {
              id: item.word.id,
              lemma: item.word.lemma,
              word_type: item.word.wordType,
              is_verified: item.word.isVerified,
            }
          : null,
      })),
      meta: { limit: query.limit, next_cursor: page.nextCursor, has_more: page.hasMore },
    });
  }

  /** GET /api/v1/votes/deck - antrean makna belum di-vote (34-api-vote-deck.md, 0101) */
  async deck(c: Context, query: VoteDeckQuery) {
    const user = this.requireUser(c);
    const page = await this.deps.deck.execute(user.user_id, {
      limit: query.limit,
      cursor: query.cursor,
      randomize: query.randomize,
    });
    return c.json({
      success: true as const,
      data: page.items.map((m) => ({
        // 0101: id = ID makna (target vote), bukan ID kata.
        id: m.id,
        word_id: m.wordId,
        lemma: m.lemma,
        language_id: m.languageId,
        language_code: m.languageCode,
        word_type: m.wordType,
        status: m.status,
        is_verified: m.isVerified,
        approved_at: m.approvedAt.toISOString(),
        sense: m.sense,
        order_index: m.orderIndex,
        meaning_count: m.meaningCount,
        // Kelas kata milik MAKNA ini, bukan kata induk. null = belum diisi.
        word_class: m.wordClass,
        upvotes: m.upvotes,
        downvotes: m.downvotes,
      })),
      meta: page.meta,
    });
  }

  /** POST /api/v1/votes/skips - lewati kartu deck (makna) tanpa vote */
  async skipDeck(c: Context, body: SkipVoteDeckBody) {
    const user = this.requireUser(c);
    // 52: meaning_id diutamakan; word_id = compat mobile ≤ v0.4.0.
    const { meaningId } = await this.deps.skipDeck.skip(user.user_id, {
      meaningId: body.meaning_id,
      wordId: body.word_id,
    });
    return c.json({
      success: true as const,
      data: { meaning_id: meaningId, skipped: true },
    });
  }

  /** DELETE /api/v1/votes/skips/:meaningId - undo skip deck (id boleh word) */
  async unskipDeck(c: Context, meaningId: string) {
    const user = this.requireUser(c);
    const resolved = await this.deps.skipDeck.unskip(user.user_id, meaningId);
    return c.json({
      success: true as const,
      data: { meaning_id: resolved.meaningId, skipped: false },
    });
  }

  /** GET /api/v1/votes/my?targets=... - vote milik user login */
  async my(c: Context, query: { targets: VoteTarget[] }) {
    const user = this.requireUser(c);
    const items = await this.deps.myVotes.execute(user.user_id, query.targets);
    return c.json({
      success: true as const,
      data: items.map((i) => ({
        target_type: i.targetType,
        target_id: i.targetId,
        value: i.value,
      })),
    });
  }

  private requireUser(c: Context): AuthUser {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }

  private requestId(c: Context): string | undefined {
    return (c as Context<{ Variables: AppVariables }>).get('requestId');
  }
}
