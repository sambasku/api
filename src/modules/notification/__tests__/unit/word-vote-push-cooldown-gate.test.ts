import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WordVotePushCooldownGate } from '../../application/use-cases/word-vote-push-cooldown-gate';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { NotificationPushCooldownRepository } from '../../domain/repositories/notification-push-cooldown.repository';

describe('WordVotePushCooldownGate', () => {
  const settingsRepo = {
    getValue: vi.fn(),
  } as unknown as AppSettingsRepository;
  const cooldownRepo = {
    get: vi.fn(),
    touch: vi.fn(),
  } as unknown as NotificationPushCooldownRepository;

  beforeEach(() => {
    vi.mocked(settingsRepo.getValue).mockReset();
    vi.mocked(cooldownRepo.get).mockReset();
    vi.mocked(cooldownRepo.touch).mockReset();
  });

  it('tanpa last push → maySend true', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('3');
    vi.mocked(cooldownRepo.get).mockResolvedValue(null);
    const gate = new WordVotePushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('masih dalam jendela → maySend false', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('3');
    vi.mocked(cooldownRepo.get).mockResolvedValue({
      userId: '01USER',
      channel: 'word_vote',
      lastPushAt: new Date(Date.now() - 60_000),
    });
    const gate = new WordVotePushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(false);
  });

  it('cooldown 0 → selalu maySend', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('0');
    vi.mocked(cooldownRepo.get).mockResolvedValue({
      userId: '01USER',
      channel: 'word_vote',
      lastPushAt: new Date(),
    });
    const gate = new WordVotePushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('touchAfterSend menulis channel word_vote', async () => {
    const gate = new WordVotePushCooldownGate(settingsRepo, cooldownRepo);
    await gate.touchAfterSend('01USER');
    expect(cooldownRepo.touch).toHaveBeenCalledWith('01USER', 'word_vote');
  });
});
