import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GetChatPingStatusUseCase,
  SendChatPingUseCase,
} from '../../application/use-cases/send-chat-ping.use-case';
import { CHAT_PING_BODY } from '../../domain/entities/chat-message.entity';
import { RateLimitedError } from '@/shared/errors/app-error';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

const USER = {
  id: 'u1',
  username: 'budi',
  displayName: 'Budi',
  avatarUrl: null,
};

function makePing(createdAt: Date) {
  return {
    id: 'm1',
    channel: 'public',
    userId: 'u1',
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    kind: 'system' as const,
    body: CHAT_PING_BODY,
    stickerId: null,
    audioUrl: null,
    audioPath: null,
    audioSha: null,
    durationMs: null,
    replyToId: null,
    replySnippet: null,
    replyUsername: null,
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: null,
  };
}

describe('SendChatPingUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('membuat jejak PING!!! saat cooldown kosong', async () => {
    const created = makePing(new Date());
    const repo = {
      findLatestPing: vi.fn(async () => null),
      create: vi.fn(async () => created),
    };
    const userRepo = { findById: vi.fn(async () => USER) };
    const mirror = { upsert: vi.fn(async () => undefined) };
    const activity = { safe: vi.fn(async () => undefined) };
    const uc = new SendChatPingUseCase(
      repo as never,
      userRepo as never,
      mirror as never,
      activity as never,
    );
    const result = await uc.execute('u1');
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'chat_ping', actorId: 'u1' }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'system', body: CHAT_PING_BODY }),
    );
    expect(result.message.body).toBe(CHAT_PING_BODY);
    expect(result.status.availableAt).toBeTruthy();
  });

  it('menolak ping dalam cooldown global', async () => {
    const last = makePing(new Date(Date.now() - 60_000));
    const repo = {
      findLatestPing: vi.fn(async () => last),
      create: vi.fn(),
    };
    const uc = new SendChatPingUseCase(
      repo as never,
      { findById: vi.fn() } as never,
      { upsert: vi.fn() } as never,
    );
    await expect(uc.execute('u1')).rejects.toBeInstanceOf(RateLimitedError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('GetChatPingStatusUseCase', () => {
  it('availableAt null jika belum pernah ping', async () => {
    const uc = new GetChatPingStatusUseCase({
      findLatestPing: vi.fn(async () => null),
    } as never);
    const s = await uc.execute();
    expect(s.availableAt).toBeNull();
    expect(s.lastPingAt).toBeNull();
  });
});
