import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WordMediaPushCooldownGate } from '../../application/use-cases/word-media-push-cooldown-gate';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { NotificationPushCooldownRepository } from '../../domain/repositories/notification-push-cooldown.repository';

describe('WordMediaPushCooldownGate (#133)', () => {
  const settingsRepo = { getValue: vi.fn() } as unknown as AppSettingsRepository;
  const cooldownRepo = { get: vi.fn(), touch: vi.fn() } as unknown as NotificationPushCooldownRepository;

  beforeEach(() => {
    vi.mocked(settingsRepo.getValue).mockReset();
    vi.mocked(cooldownRepo.get).mockReset();
    vi.mocked(cooldownRepo.touch).mockReset();
  });

  it('tanpa last push → maySend true', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('3');
    vi.mocked(cooldownRepo.get).mockResolvedValue(null);
    const gate = new WordMediaPushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('masih dalam jendela → maySend false', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('3');
    vi.mocked(cooldownRepo.get).mockResolvedValue({
      userId: '01USER',
      channel: 'word_media',
      lastPushAt: new Date(Date.now() - 60_000),
    });
    const gate = new WordMediaPushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(false);
  });

  it('setelah jendela lewat → maySend true lagi', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('3');
    vi.mocked(cooldownRepo.get).mockResolvedValue({
      userId: '01USER',
      channel: 'word_media',
      lastPushAt: new Date(Date.now() - 4 * 60_000),
    });
    const gate = new WordMediaPushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('cooldown 0 → selalu boleh tanpa baca tabel', async () => {
    vi.mocked(settingsRepo.getValue).mockResolvedValue('0');
    const gate = new WordMediaPushCooldownGate(settingsRepo, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
    expect(cooldownRepo.get).not.toHaveBeenCalled();
  });

  it('touchAfterSend menulis channel word_media', async () => {
    vi.mocked(cooldownRepo.touch).mockResolvedValue(undefined);
    const gate = new WordMediaPushCooldownGate(settingsRepo, cooldownRepo);
    await gate.touchAfterSend('01USER');
    expect(cooldownRepo.touch).toHaveBeenCalledWith('01USER', 'word_media');
  });
});
