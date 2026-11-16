import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { CreateDiscussionLemmaLinkUseCase } from '../../application/use-cases/create-discussion-lemma-link.use-case';
import { ProposeDiscussionLemmaCorrectionUseCase } from '../../application/use-cases/propose-discussion-lemma-correction.use-case';
import type {
  Discussion,
  DiscussionLemmaLink,
  DiscussionReply,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

const OWNER = '01OWNERDISC00000000000000';
const OTHER = '01OTHERDISC00000000000000';
const DISC_ID = '01DISC0000000000000000001';
const REPLY_ID = '01REPLY000000000000000001';
const WORD_ID = '01WORD00000000000000000001';
const WORD2 = '01WORD00000000000000000002';

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: DISC_ID,
    userId: OWNER,
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: null,
    body: 'Aku makan nasi',
    bodyOriginal: null,
    linkUrl: null,
    images: [],
    audio: null,
    status: 'published',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    lastReplyAt: null,
    publishedReplyCount: 0,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function makeReply(overrides: Partial<DiscussionReply> = {}): DiscussionReply {
  return {
    id: REPLY_ID,
    discussionId: DISC_ID,
    userId: OTHER,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    body: 'Enak sekali',
    bodyOriginal: null,
    audio: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function makeLink(overrides: Partial<DiscussionLemmaLink> = {}): DiscussionLemmaLink {
  return {
    id: '01LINK00000000000000000001',
    discussionId: DISC_ID,
    replyId: null,
    start: 4,
    end: 9,
    wordId: WORD_ID,
    lemma: 'makan',
    status: 'active',
    source: 'author',
    proposedWordId: null,
    proposedLemma: null,
    proposedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

function repo(overrides: Partial<DiscussionRepository> = {}): DiscussionRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => makeDiscussion()),
    list: vi.fn(),
    updateStatus: vi.fn(),
    setPinnedReply: vi.fn(),
    createReply: vi.fn(),
    findReplyById: vi.fn(async () => makeReply()),
    listReplies: vi.fn(),
    countPublishedRepliesByDiscussionIds: vi.fn(),
    listDistinctReplierUserIds: vi.fn(),
    setDiscussionAudio: vi.fn(),
    markReplyDeletedByAuthor: vi.fn(),
    takedownReply: vi.fn(),
    markDiscussionDeletedByAuthor: vi.fn(),
    updateReplyBodyWithRevision: vi.fn(),
    listReplyRevisions: vi.fn(),
    updateDiscussionBodyWithRevision: vi.fn(),
    listDiscussionRevisions: vi.fn(),
    markLemmaLinksStale: vi.fn(async () => 0),
    markReplyLemmaLinksStale: vi.fn(async () => 0),
    createLemmaLink: vi.fn(async () => makeLink()),
    findLemmaLinkById: vi.fn(async () => makeLink()),
    listLemmaLinksByDiscussionId: vi.fn(async () => []),
    listActiveLemmaLinksForTarget: vi.fn(async () => []),
    updateLemmaLink: vi.fn(async () =>
      makeLink({ status: 'pending_correction' }),
    ),
    deleteLemmaLink: vi.fn(async () => true),
    ...overrides,
  };
}

const words = {
  findById: vi.fn(async (id: string) => ({
    id,
    status: 'published',
    isVerified: true,
    deletedAt: null,
    lemma: id === WORD2 ? 'nasi' : 'makan',
  })),
};

const audit = { record: vi.fn(async () => undefined) } as never;

describe('Discussion lemma links', () => {
  it('create OP: owner + span valid → source author', async () => {
    const r = repo();
    const out = await new CreateDiscussionLemmaLinkUseCase(
      r,
      words as never,
      audit,
    ).execute({
      discussionId: DISC_ID,
      userId: OWNER,
      start: 4,
      end: 9,
      wordId: WORD_ID,
    });
    expect(out.lemma).toBe('makan');
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'author',
        status: 'active',
        wordId: WORD_ID,
        replyId: null,
      }),
    );
  });

  it('create reply: span on reply body → source author of reply', async () => {
    const r = repo({
      createLemmaLink: vi.fn(async () =>
        makeLink({ replyId: REPLY_ID, start: 0, end: 4, lemma: 'Enak' }),
      ),
    });
    await new CreateDiscussionLemmaLinkUseCase(r, words as never, audit).execute(
      {
        discussionId: DISC_ID,
        userId: OTHER,
        start: 0,
        end: 4,
        wordId: WORD_ID,
        replyId: REPLY_ID,
      },
    );
    expect(r.createLemmaLink).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'author',
        replyId: REPLY_ID,
        start: 0,
        end: 4,
      }),
    );
  });

  it('create: span invalid → ValidationError', async () => {
    await expect(
      new CreateDiscussionLemmaLinkUseCase(repo(), words as never, audit).execute(
        {
          discussionId: DISC_ID,
          userId: OWNER,
          start: 0,
          end: 99,
          wordId: WORD_ID,
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('propose correction → pending_correction', async () => {
    const r = repo();
    await new ProposeDiscussionLemmaCorrectionUseCase(
      r,
      words as never,
      audit,
    ).execute({
      discussionId: DISC_ID,
      linkId: '01LINK00000000000000000001',
      userId: OTHER,
      wordId: WORD2,
    });
    expect(r.updateLemmaLink).toHaveBeenCalledWith(
      '01LINK00000000000000000001',
      expect.objectContaining({
        status: 'pending_correction',
        proposedWordId: WORD2,
      }),
    );
  });
});
