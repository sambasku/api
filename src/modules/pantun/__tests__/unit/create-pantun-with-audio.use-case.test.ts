import { describe, it, expect, vi } from 'vitest';
import { CreatePantunWithAudioUseCase } from '../../application/use-cases/create-pantun-with-audio.use-case';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { Pantun } from '../../domain/entities/pantun.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';

const ACTOR = '01JDACTOR00000000000000001';
const ABAB = [
  'Pergi berjalan ke Sambas',
  'Membeli ikan di pasar',
  'Pulang bawa rumbas',
  'Hatiku girang bersinar',
];

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

function makePantun(overrides: Partial<Pantun> = {}): Pantun {
  return {
    id: '01JDPANTUN0000000000000001',
    userId: ACTOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ABAB,
    audio: {
      url: 'https://cdn.example/p.wav',
      mimeType: 'audio/wav',
      fileSize: 64,
      durationMs: 12_000,
      provider: 'github',
      providerFileId: 'assets/audio/pantuns/x/y.wav',
      sha: 'abc',
    },
    status: 'published',
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

describe('CreatePantunWithAudioUseCase', () => {
  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  } as unknown as AuditLogRepository;
  const blocklist = { listAllActiveWords: vi.fn().mockResolvedValue([]) };

  function makeStorage(): PronunciationStoragePort {
    return {
      providerName: 'github',
      upload: vi.fn().mockResolvedValue({
        path: 'assets/audio/pantuns/x/y.wav',
        url: 'https://cdn.example/p.wav',
        sha: 'abc',
        size: 64,
      }),
      delete: vi.fn(),
    };
  }

  it('teks + audio 12s → tersimpan dengan audio', async () => {
    const storage = makeStorage();
    const repo = {
      create: vi.fn().mockImplementation(async (input) =>
        makePantun({
          id: input.id,
          lines: input.lines,
          rhymeScheme: input.rhymeScheme,
          audio: input.audio,
        }),
      ),
    } as unknown as PantunRepository;

    const uc = new CreatePantunWithAudioUseCase(
      repo,
      storage,
      audit,
      blocklist as never,
    );
    const row = await uc.execute({
      userId: ACTOR,
      lines: ABAB,
      rhymeScheme: 'ABAB',
      bytes: makeWavBytes(),
      mimeType: 'audio/wav',
      durationMs: 12_000,
    });
    expect(row.audio?.durationMs).toBe(12_000);
    expect(repo.create).toHaveBeenCalledOnce();
    expect(storage.upload).toHaveBeenCalledOnce();
  });

  it('voice-only (tanpa teks) → lines kosong', async () => {
    const storage = makeStorage();
    const repo = {
      create: vi.fn().mockImplementation(async (input) =>
        makePantun({
          id: input.id,
          lines: input.lines,
          rhymeScheme: input.rhymeScheme,
          audio: input.audio,
        }),
      ),
    } as unknown as PantunRepository;
    const uc = new CreatePantunWithAudioUseCase(
      repo,
      storage,
      audit,
      blocklist as never,
    );
    const row = await uc.execute({
      userId: ACTOR,
      lines: [],
      bytes: makeWavBytes(),
      mimeType: 'audio/wav',
      durationMs: 12_000,
    });
    expect(row.lines).toEqual([]);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [] }),
    );
  });

  it('durasi <10s → ditolak sebelum upload', async () => {
    const storage = makeStorage();
    const repo = { create: vi.fn() } as unknown as PantunRepository;
    const uc = new CreatePantunWithAudioUseCase(
      repo,
      storage,
      audit,
      blocklist as never,
    );
    await expect(
      uc.execute({
        userId: ACTOR,
        lines: ABAB,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
        durationMs: 5_000,
      }),
    ).rejects.toMatchObject({
      details: [expect.objectContaining({ field: 'duration_ms' })],
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
