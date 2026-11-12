import { describe, it, expect, vi } from 'vitest';
import {
  publicReadGate,
  VERIFIER_VISIBLE_STATUSES,
} from '../../application/utils/resolve-publication';
import { GetWordByIdUseCase } from '../../application/use-cases/get-word-by-id.use-case';
import { GetWordByLemmaUseCase } from '../../application/use-cases/get-word-by-lemma.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { WordDetail } from '../../domain/entities/word.entity';

const DETAIL = { id: '01WORD', lemma: 'makatn' } as unknown as WordDetail;

describe('publicReadGate', () => {
  it('tamu / contributor → published + isVerified', () => {
    expect(publicReadGate(undefined)).toEqual({ published: true, isVerified: true });
    expect(publicReadGate(['contributor'])).toEqual({ published: true, isVerified: true });
  });

  it('verifikator → statuses pending_review + published', () => {
    expect(publicReadGate(['reviewer'])).toEqual({ statuses: VERIFIER_VISIBLE_STATUSES });
    expect(publicReadGate(['admin', 'contributor'])).toEqual({
      statuses: VERIFIER_VISIBLE_STATUSES,
    });
    expect(VERIFIER_VISIBLE_STATUSES).toEqual(['published', 'pending_review']);
  });
});

describe('GetWordByIdUseCase - gate viewer', () => {
  it('verifikator → findDetailById dengan statuses', async () => {
    const findDetailById = vi.fn().mockResolvedValue(DETAIL);
    const uc = new GetWordByIdUseCase({ findDetailById } as unknown as WordRepository);
    await uc.execute('01WORD', { viewerRoles: ['editor'] });
    expect(findDetailById).toHaveBeenCalledWith('01WORD', {
      includeAllStatuses: undefined,
      statuses: VERIFIER_VISIBLE_STATUSES,
    });
  });

  it('includeAllStatuses mengalahkan gate viewer', async () => {
    const findDetailById = vi.fn().mockResolvedValue(DETAIL);
    const uc = new GetWordByIdUseCase({ findDetailById } as unknown as WordRepository);
    await uc.execute('01WORD', { includeAllStatuses: true, viewerRoles: ['reviewer'] });
    expect(findDetailById).toHaveBeenCalledWith('01WORD', {
      includeAllStatuses: true,
      statuses: undefined,
    });
  });
});

describe('GetWordByLemmaUseCase - gate viewer', () => {
  it('tamu → tanpa statuses (repo default published+verified)', async () => {
    const findPublishedDetailByLemma = vi.fn().mockResolvedValue(DETAIL);
    const uc = new GetWordByLemmaUseCase({
      findPublishedDetailByLemma,
    } as unknown as WordRepository);
    await uc.execute('makatn');
    expect(findPublishedDetailByLemma).toHaveBeenCalledWith('makatn', {
      statuses: undefined,
    });
  });

  it('verifikator → statuses diteruskan', async () => {
    const findPublishedDetailByLemma = vi.fn().mockResolvedValue(DETAIL);
    const uc = new GetWordByLemmaUseCase({
      findPublishedDetailByLemma,
    } as unknown as WordRepository);
    await uc.execute('makatn', { viewerRoles: ['root'] });
    expect(findPublishedDetailByLemma).toHaveBeenCalledWith('makatn', {
      statuses: VERIFIER_VISIBLE_STATUSES,
    });
  });
});
