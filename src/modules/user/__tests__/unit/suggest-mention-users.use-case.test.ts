import { describe, it, expect, vi } from 'vitest';
import { SuggestMentionUsersUseCase, MENTION_SUGGEST_LIMIT } from '../../application/use-cases/suggest-mention-users.use-case';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';
import type { MentionUserRow } from '../../domain/entities/public-profile.entity';

describe('SuggestMentionUsersUseCase', () => {
  it('return empty array untuk query < 2 karakter', async () => {
    const repo = {
      suggestByUsernamePrefix: vi.fn().mockResolvedValue([]),
    } as unknown as PublicUserRepository;

    const uc = new SuggestMentionUsersUseCase(repo);
    const result = await uc.execute('a');

    expect(result).toEqual([]);
    expect(repo.suggestByUsernamePrefix).not.toHaveBeenCalled();
  });

  it('return empty array untuk query kosong', async () => {
    const repo = {
      suggestByUsernamePrefix: vi.fn().mockResolvedValue([]),
    } as unknown as PublicUserRepository;

    const uc = new SuggestMentionUsersUseCase(repo);
    const result = await uc.execute('');

    expect(result).toEqual([]);
    expect(repo.suggestByUsernamePrefix).not.toHaveBeenCalled();
  });

  it('trim lowercase dan panggil repo dengan limit', async () => {
    const mockItems: MentionUserRow[] = [
      { id: 'u1', username: 'budi', displayName: 'Budi Santoso', avatarUrl: null },
      { id: 'u2', username: 'budiman', displayName: 'Budiman', avatarUrl: 'https://example.com/avatar.jpg' },
    ];
    const repo = {
      suggestByUsernamePrefix: vi.fn().mockResolvedValue(mockItems),
    } as unknown as PublicUserRepository;

    const uc = new SuggestMentionUsersUseCase(repo);
    const result = await uc.execute('  Budi  ');

    expect(repo.suggestByUsernamePrefix).toHaveBeenCalledWith('budi', MENTION_SUGGEST_LIMIT);
    expect(result).toEqual(mockItems);
  });

  it('limit default 10', async () => {
    const repo = {
      suggestByUsernamePrefix: vi.fn().mockResolvedValue([]),
    } as unknown as PublicUserRepository;

    const uc = new SuggestMentionUsersUseCase(repo);
    await uc.execute('test');

    expect(repo.suggestByUsernamePrefix).toHaveBeenCalledWith('test', 10);
  });
});