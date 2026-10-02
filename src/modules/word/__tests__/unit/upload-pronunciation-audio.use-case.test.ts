import { describe, it, expect, vi } from 'vitest';
import { UploadPronunciationAudioUseCase } from '../../application/use-cases/upload-pronunciation-audio.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PronunciationStoragePort } from '../../application/ports/pronunciation-storage.port';

const WORD = { id: '01WORDULID000000000000000', lemma: 'makatn' } as {
  id: string;
  lemma: string;
};

const CONTRIBUTOR = {
  userId: '01CONTRIBUTORULID0000000',
  roles: ['contributor'],
  role: 'contributor',
  requestId: null,
};
const ADMIN = {
  userId: '01ADMINULID00000000000000',
  roles: ['admin'],
  role: 'admin',
  requestId: null,
};

/** Minimal ftyp box so validateAudioFile accepts audio/mp4. */
const SAMPLE_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

function makeDeps() {
  const wordRepo = {
    findById: vi.fn().mockResolvedValue(WORD),
    findExampleWithWord: vi.fn(),
    findDialectCode: vi.fn(),
    countWordAudios: vi.fn().mockResolvedValue(0),
    addWordAudio: vi.fn().mockImplementation(
      (_wid: string, data: { status: string; isVerified: boolean; speakerName: string | null }) =>
        Promise.resolve({
          id: '01AUDIOULID000000000000000',
          wordId: WORD.id,
          exampleId: null,
          dialectId: null,
          url: 'https://cdn.jsdelivr.net/gh/x/a.m4a',
          mimeType: 'audio/mp4',
          fileSize: SAMPLE_BYTES.length,
          durationMs: null,
          speakerName: data.speakerName,
          isPrimary: true,
          status: data.status,
          isVerified: data.isVerified,
          isCorrected: false,
        }),
    ),
  } as unknown as WordRepository;

  const storage = {
    providerName: 'github',
    upload: vi.fn().mockResolvedValue({
      path: 'assets/audio/umum/makatn/01AUDIOULID000000000000000.m4a',
      sha: 'abc',
      url: 'https://cdn.jsdelivr.net/gh/x/a.m4a',
      size: SAMPLE_BYTES.length,
    }),
  } as unknown as PronunciationStoragePort;

  const auditRepo = {
    record: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
  };

  return { wordRepo, storage, auditRepo };
}

function makeUseCase() {
  const deps = makeDeps();
  const useCase = new UploadPronunciationAudioUseCase(
    deps.wordRepo,
    deps.storage,
    deps.auditRepo as unknown as AuditLogRepository,
  );
  return { ...deps, useCase };
}

describe('UploadPronunciationAudioUseCase', () => {
  it('contributor → pending_review, belum verified', async () => {
    const { wordRepo, useCase } = makeUseCase();
    const media = await useCase.execute(
      WORD.id,
      {
        bytes: SAMPLE_BYTES,
        mimeType: 'audio/mp4',
        filename: 'a.m4a',
        speakerName: 'Ali',
      },
      CONTRIBUTOR,
    );
    expect(media.status).toBe('pending_review');
    expect(media.isVerified).toBe(false);
    expect(wordRepo.addWordAudio).toHaveBeenCalledWith(
      WORD.id,
      expect.objectContaining({
        status: 'pending_review',
        isVerified: false,
        speakerName: 'Ali',
      }),
      CONTRIBUTOR.userId,
    );
  });

  it('contributor tanpa speaker_name → null (anonim)', async () => {
    const { wordRepo, useCase } = makeUseCase();
    const media = await useCase.execute(
      WORD.id,
      { bytes: SAMPLE_BYTES, mimeType: 'audio/mp4', filename: 'a.m4a' },
      CONTRIBUTOR,
    );
    expect(media.speakerName).toBeNull();
    expect(wordRepo.addWordAudio).toHaveBeenCalledWith(
      WORD.id,
      expect.objectContaining({ speakerName: null, status: 'pending_review' }),
      CONTRIBUTOR.userId,
    );
  });

  it('admin → published + verified', async () => {
    const { useCase } = makeUseCase();
    const media = await useCase.execute(
      WORD.id,
      { bytes: SAMPLE_BYTES, mimeType: 'audio/mp4', filename: 'a.m4a' },
      ADMIN,
    );
    expect(media.status).toBe('published');
    expect(media.isVerified).toBe(true);
  });
});
