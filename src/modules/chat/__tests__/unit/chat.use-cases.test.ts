import { describe, expect, it, vi } from 'vitest';
import { BadRequestError, ValidationError } from '@/shared/errors/app-error';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  CreateChatMessageUseCase,
  CreateChatVoiceNoteUseCase,
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
const VOICE_MSG_ID = '01CHATVOICE000000000000001';

/** Minimal valid WAV (RIFF....WAVE) for magic-byte check. */
function makeWavBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0x52;
  bytes[1] = 0x49;
  bytes[2] = 0x46;
  bytes[3] = 0x46;
  bytes[8] = 0x57;
  bytes[9] = 0x41;
  bytes[10] = 0x56;
  bytes[11] = 0x45;
  return bytes;
}

function makeStorage(
  overrides: Partial<PronunciationStoragePort> = {},
): PronunciationStoragePort {
  return {
    providerName: 'github',
    upload: vi.fn().mockResolvedValue({
      path: `assets/audio/chat/${VOICE_MSG_ID}.wav`,
      url: 'https://cdn.example/chat/voice.wav',
      sha: 'sha-voice-1',
      size: 64,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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

const stickerRepo = {
  findActiveById: vi.fn(async (id: string) =>
    id
      ? {
          id,
          imageUrl: `https://cdn.example/${id}.png`,
          playOnce: false,
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        }
      : null,
  ),
} as never;

describe('CreateChatMessageUseCase', () => {
  it('insert Turso lalu mirror upsert', async () => {
    const repo = emptyRepo();
    const mirror = emptyMirror();
    const uc = new CreateChatMessageUseCase(
      repo,
      userRepo,
      blocklistRepo,
      mirror,
      stickerRepo,
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

  it('sensor email di body jadi ***', async () => {
    const repo = emptyRepo({
      create: vi.fn(async (input) => makeMessage({ body: input.body ?? null })),
    });
    const uc = new CreateChatMessageUseCase(
      repo,
      userRepo,
      blocklistRepo,
      emptyMirror(),
      stickerRepo,
    );
    const result = await uc.execute({
      userId: ACTOR,
      kind: 'text',
      body: 'hubungi a@b.co ya',
    });
    expect(result.body).toBe('hubungi *** ya');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'hubungi *** ya' }),
    );
  });

  it('gagal validasi bila body teks kosong', async () => {
    const uc = new CreateChatMessageUseCase(
      emptyRepo(),
      userRepo,
      blocklistRepo,
      emptyMirror(),
      stickerRepo,
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
      stickerRepo,
    );
    await expect(
      uc.execute({ userId: ACTOR, kind: 'sticker', stickerId: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('gagal validasi sticker id tidak aktif', async () => {
    const missing = {
      findActiveById: vi.fn(async () => null),
    } as never;
    const uc = new CreateChatMessageUseCase(
      emptyRepo(),
      userRepo,
      blocklistRepo,
      emptyMirror(),
      missing,
    );
    await expect(
      uc.execute({ userId: ACTOR, kind: 'sticker', stickerId: 'ghost' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('CreateChatVoiceNoteUseCase', () => {
  it('upload path assets/audio/chat/... lalu insert voice_note + mirror tanpa path/sha', async () => {
    const created = makeMessage({
      id: VOICE_MSG_ID,
      kind: 'voice_note',
      body: null,
      audioUrl: 'https://cdn.example/chat/voice.wav',
      audioPath: `assets/audio/chat/${VOICE_MSG_ID}.wav`,
      audioSha: 'sha-voice-1',
      durationMs: 4200,
    });
    const repo = emptyRepo({
      create: vi.fn(async () => created),
    });
    const mirror = emptyMirror();
    const storage = makeStorage();
    const uc = new CreateChatVoiceNoteUseCase(
      repo,
      userRepo,
      storage,
      mirror,
    );

    const result = await uc.execute({
      userId: ACTOR,
      bytes: makeWavBytes(),
      mimeType: 'audio/wav',
      filename: 'note.wav',
      durationMs: 4200,
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^assets\/audio\/chat\/.+\.wav$/),
        mimeType: 'audio/wav',
      }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'voice_note',
        body: null,
        audioUrl: 'https://cdn.example/chat/voice.wav',
        audioPath: expect.stringMatching(/^assets\/audio\/chat\//),
        audioSha: 'sha-voice-1',
        durationMs: 4200,
      }),
    );
    // Use-case mirror.upsert(entity); ChatSupabaseMirror.toMirrorPayload
    // sengaja tanpa audio_path/audio_sha (hanya audio_url + duration_ms).
    expect(mirror.upsert).toHaveBeenCalledWith(result);
    expect(result.audioUrl).toBe('https://cdn.example/chat/voice.wav');
    expect(result.durationMs).toBe(4200);
    expect(result.audioPath).toMatch(/^assets\/audio\/chat\//);
    expect(result.audioSha).toBe('sha-voice-1');
  });

  it('upload gagal → tidak insert Turso', async () => {
    const repo = emptyRepo();
    const storage = makeStorage({
      upload: vi.fn().mockRejectedValue(new Error('github down')),
    });
    const uc = new CreateChatVoiceNoteUseCase(
      repo,
      userRepo,
      storage,
      emptyMirror(),
    );
    await expect(
      uc.execute({
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
        durationMs: 2000,
      }),
    ).rejects.toThrow('github down');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('duration di luar 1000..60000 → ValidationError', async () => {
    const uc = new CreateChatVoiceNoteUseCase(
      emptyRepo(),
      userRepo,
      makeStorage(),
      emptyMirror(),
    );
    await expect(
      uc.execute({
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
        durationMs: 500,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      uc.execute({
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
        durationMs: 60_001,
      }),
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

  it('voice_note tidak bisa disunting', async () => {
    const repo = emptyRepo({
      findById: vi.fn(async () =>
        makeMessage({
          kind: 'voice_note',
          body: null,
          audioUrl: 'https://cdn.example/a.wav',
          durationMs: 3000,
        }),
      ),
    });
    const uc = new EditChatMessageUseCase(repo, blocklistRepo, emptyMirror());
    await expect(
      uc.execute({
        messageId: MSG_ID,
        actorId: ACTOR,
        body: 'coba ganti teks',
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(repo.editText).not.toHaveBeenCalled();
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

  it('voice_note → storage.delete dipanggil lalu tombstone', async () => {
    const voice = makeMessage({
      kind: 'voice_note',
      body: null,
      audioUrl: 'https://cdn.example/chat/voice.wav',
      audioPath: 'assets/audio/chat/01CHATVOICE000000000000001.wav',
      audioSha: 'sha-voice-1',
      durationMs: 4200,
    });
    const tombstoned = makeMessage({
      kind: 'voice_note',
      body: null,
      audioUrl: null,
      audioPath: null,
      audioSha: null,
      durationMs: null,
      deletedAt: new Date(),
      deletedBy: ACTOR,
    });
    const repo = emptyRepo({
      findById: vi.fn(async () => voice),
      tombstone: vi.fn(async () => tombstoned),
    });
    const storage = makeStorage();
    const mirror = emptyMirror();
    const uc = new DeleteChatMessageUseCase(repo, mirror, storage);
    await uc.execute({ messageId: MSG_ID, actorId: ACTOR });
    expect(storage.delete).toHaveBeenCalledWith(
      'assets/audio/chat/01CHATVOICE000000000000001.wav',
      'sha-voice-1',
    );
    expect(repo.tombstone).toHaveBeenCalled();
    expect(mirror.patch).toHaveBeenCalledWith(tombstoned);
  });
});
