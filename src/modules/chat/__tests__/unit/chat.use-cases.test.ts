import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import {
  CreateChatMessageUseCase,
  DeleteChatMessageUseCase,
  EditChatMessageUseCase,
  GetChatCapabilitiesUseCase,
} from '../../application/use-cases/chat.use-cases';
import type { ChatMessage } from '../../domain/entities/chat-message.entity';
import type { ChatRepository } from '../../domain/repositories/chat.repository';
import type { ChatSupabaseMirror } from '../../infrastructure/chat-supabase-mirror';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn(async () => undefined),
}));

vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
}));

vi.mock(
  '@/modules/comment-blocklist/application/utils/apply-blocklist-filter',
  () => ({
    applyBlocklistFilter: vi.fn((text: string) => text),
  }),
);

const ACTOR = '01ACTORCHAT000000000000000';
const MSG_ID = '01CHATMSG00000000000000001';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: MSG_ID,
    channel: 'public',
    userId: ACTOR,
    username: 'rani',
    displayName: 'Rani',
    avatarUrl: null,
    kind: 'text',
    body: 'halo sambas',
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
    deletedBy: null,
    createdAt: new Date('2026-11-17T14:02:00.000Z'),
    updatedAt: null,
    ...overrides,
  };
}

function emptyRepo(overrides: Partial<ChatRepository> = {}): ChatRepository {
  return {
    create: vi.fn(async () => makeMessage()),
    findById: vi.fn(async () => makeMessage()),
    list: vi.fn(),
    editText: vi.fn(async () =>
      makeMessage({ body: 'disunting', editedAt: new Date() }),
    ),
    tombstone: vi.fn(async () =>
      makeMessage({
        body: null,
        stickerId: null,
        deletedAt: new Date(),
        deletedBy: ACTOR,
      }),
    ),
    listRevisions: vi.fn(async () => []),
    ...overrides,
  };
}

function emptyMirror(
  overrides: Partial<ChatSupabaseMirror> = {},
): ChatSupabaseMirror {
  return {
    upsert: vi.fn(async () => undefined),
    patch: vi.fn(async () => undefined),
    ...overrides,
  };
}

const userRepo = {
  findById: vi.fn(async () => ({
    id: ACTOR,
    username: 'rani',
    displayName: 'Rani',
    avatarUrl: null,
  })),
} as never;

const blocklistRepo = {
  listAllActiveWords: vi.fn(async () => []),
} as never;

describe('GetChatCapabilitiesUseCase', () => {
  it('reads voice.room_enabled from settings', async () => {
    const uc = new GetChatCapabilitiesUseCase({
      getByKeys: vi.fn(async () => [
        { key: 'voice.room_enabled', value: 'true' },
      ]),
    } as never);
    await expect(uc.execute()).resolves.toEqual({ voice_room_enabled: true });
  });

  it('defaults false when missing', async () => {
    const uc = new GetChatCapabilitiesUseCase({
      getByKeys: vi.fn(async () => []),
    } as never);
    await expect(uc.execute()).resolves.toEqual({ voice_room_enabled: false });
  });
});

describe('CreateChatMessageUseCase', () => {
  it('insert Turso lalu mirror upsert', async () => {
    const repo = emptyRepo();
    const mirror = emptyMirror();
    const uc = new CreateChatMessageUseCase(
      repo,
      userRepo,
      blocklistRepo,
      mirror,
    );
    const result = await uc.execute({
      userId: ACTOR,
      kind: 'text',
      body: 'halo sambas',
    });
    expect(result.body).toBe('halo sambas');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'public',
        kind: 'text',
        body: 'halo sambas',
        username: 'rani',
        displayName: 'Rani',
      }),
    );
    expect(mirror.upsert).toHaveBeenCalledWith(result);
  });

  it('gagal validasi bila body teks kosong', async () => {
    const uc = new CreateChatMessageUseCase(
      emptyRepo(),
      userRepo,
      blocklistRepo,
      emptyMirror(),
    );
    await expect(
      uc.execute({ userId: ACTOR, kind: 'text', body: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('gagal validasi sticker tanpa sticker_id', async () => {
    const uc = new CreateChatMessageUseCase(
      emptyRepo(),
      userRepo,
      blocklistRepo,
      emptyMirror(),
    );
    await expect(
      uc.execute({ userId: ACTOR, kind: 'sticker', stickerId: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('EditChatMessageUseCase', () => {
  it('menulis revisi body lama lalu mirror patch', async () => {
    const repo = emptyRepo({
      findById: vi.fn(async () => makeMessage({ body: 'lama' })),
      editText: vi.fn(async () =>
        makeMessage({ body: 'baru', editedAt: new Date() }),
      ),
    });
    const mirror = emptyMirror();
    const uc = new EditChatMessageUseCase(repo, blocklistRepo, mirror);
    const result = await uc.execute({
      messageId: MSG_ID,
      actorId: ACTOR,
      body: 'baru',
    });
    expect(repo.editText).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MSG_ID,
        editorId: ACTOR,
        previousBody: 'lama',
        body: 'baru',
      }),
    );
    expect(mirror.patch).toHaveBeenCalledWith(result);
  });
});

describe('DeleteChatMessageUseCase', () => {
  it('tombstone lalu mirror patch', async () => {
    const tombstoned = makeMessage({
      body: null,
      deletedAt: new Date(),
      deletedBy: ACTOR,
    });
    const repo = emptyRepo({
      tombstone: vi.fn(async () => tombstoned),
    });
    const mirror = emptyMirror();
    const uc = new DeleteChatMessageUseCase(repo, mirror);
    const result = await uc.execute({ messageId: MSG_ID, actorId: ACTOR });
    expect(repo.tombstone).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MSG_ID,
        deletedBy: ACTOR,
        reason: 'author',
      }),
    );
    expect(mirror.patch).toHaveBeenCalledWith(result);
    expect(result.body).toBeNull();
  });
});
