import { describe, it, expect, vi } from 'vitest';
import { GetPublicProfileUseCase } from '../../application/use-cases/get-public-profile.use-case';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

const JOINED = new Date('2026-08-01T00:00:00Z');

function makeRepo(
  user: Awaited<ReturnType<PublicUserRepository['findPublicByUsername']>>,
  statsOverride?: Partial<{
    contributionsApproved: number;
    wordsApproved: number;
    correctionsApproved: number;
    verificationsDone: number;
    commentsPublished: number;
  }>,
) {
  const stats = {
    contributionsApproved: 12,
    wordsApproved: 4,
    correctionsApproved: 8,
    verificationsDone: 34,
    commentsPublished: 5,
    leveling: {
      points: 60,
      level: 2,
      nextLevelPoints: 80,
      titleCode: 'pencatat',
      exploration: 4,
      accuracy: 42,
      depth: 8,
      streakDays: 0,
    },
    ...statsOverride,
  };
  return {
    findPublicByUsername: vi.fn().mockResolvedValue(user),
    suggestByUsernamePrefix: vi.fn(),
    loadStats: vi.fn().mockResolvedValue(stats),
    listRecentApprovedContributions: vi.fn(),
    listRecentPublishedComments: vi.fn(),
    listRecentVerifications: vi.fn(),
    listRecentVotes: vi.fn(),
  } satisfies PublicUserRepository;
}

describe('GetPublicProfileUseCase', () => {
  it('reviewer → is_verifier true + stats diteruskan', async () => {
    const repo = makeRepo({
      id: '01JDUSERREVIEW000000000000',
      username: 'budi',
      displayName: 'budi',
      bio: null,
      roles: ['reviewer'],
      role: 'reviewer',
      joinedAt: JOINED,
      avatarUrl: null,
    });
    const profile = await new GetPublicProfileUseCase(repo).execute('budi');

    expect(repo.findPublicByUsername).toHaveBeenCalledWith('budi');
    expect(profile).toMatchObject({
      username: 'budi',
      displayName: 'budi',
      bio: null,
      roles: ['reviewer'],
      role: 'reviewer',
      isVerifier: true,
      joinedAt: JOINED,
      avatarUrl: null,
      stats: {
        contributionsApproved: 12,
        wordsApproved: 4,
        correctionsApproved: 8,
        verificationsDone: 34,
        commentsPublished: 5,
      },
    });
  });

  it('kontributor biasa → is_verifier false + avatar cdnpublish', async () => {
    const repo = makeRepo({
      id: '01JDUSERKONTRIB00000000000',
      username: 'siti',
      displayName: 'siti',
      bio: 'hobi masak',
      roles: [],
      role: 'user',
      joinedAt: JOINED,
      avatarUrl: 'https://cdn.jsdelivr.net/gh/x/y@main/a.jpg',
    });
    const profile = await new GetPublicProfileUseCase(repo).execute('siti');

    expect(profile.isVerifier).toBe(false);
    expect(profile.avatarUrl).toContain('jsdelivr');
  });

  it('user baru (0 stats) → loadStats dipanggil dan angka 0 diteruskan', async () => {
    const repo = makeRepo(
      {
        id: '01JDUSERNEW0000000000000',
        username: 'baru',
        displayName: 'baru',
        bio: null,
        roles: [],
        role: 'user',
        joinedAt: JOINED,
        avatarUrl: null,
      },
      {
        contributionsApproved: 0,
        wordsApproved: 0,
        correctionsApproved: 0,
        verificationsDone: 0,
        commentsPublished: 0,
      },
    );
    const profile = await new GetPublicProfileUseCase(repo).execute('baru');

    expect(repo.loadStats).toHaveBeenCalledWith('01JDUSERNEW0000000000000');
    expect(profile.stats).toMatchObject({
      contributionsApproved: 0,
      wordsApproved: 0,
      correctionsApproved: 0,
      verificationsDone: 0,
      commentsPublished: 0,
    });
  });

  it('user tidak ditemukan → 404 USER_NOT_FOUND', async () => {
    const repo = makeRepo(null);
    const useCase = new GetPublicProfileUseCase(repo);

    await expect(useCase.execute('tidakada')).rejects.toMatchObject({
      errorCode: 'USER_NOT_FOUND',
      statusCode: 404,
    });

    expect(repo.loadStats).not.toHaveBeenCalled();
  });
});