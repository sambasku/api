import { describe, it, expect, vi } from 'vitest';
import { WordCommentPushCooldownGate } from '../../application/use-cases/word-comment-push-cooldown-gate';
import type { NotificationPushCooldownRepository } from '../../domain/repositories/notification-push-cooldown.repository';

describe('WordCommentPushCooldownGate', () => {
  it('tanpa last push → boleh kirim', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('3') };
    const cooldownRepo = {
      get: vi.fn().mockResolvedValue(null),
      touch: vi.fn(),
    } as unknown as NotificationPushCooldownRepository;
    const gate = new WordCommentPushCooldownGate(settingsRepo as never, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('dalam jendela 3 menit → skip', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('3') };
    const cooldownRepo = {
      get: vi.fn().mockResolvedValue({
        userId: '01USER',
        channel: 'word_comment',
        lastPushAt: new Date(Date.now() - 60_000),
      }),
      touch: vi.fn(),
    } as unknown as NotificationPushCooldownRepository;
    const gate = new WordCommentPushCooldownGate(settingsRepo as never, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(false);
  });

  it('setelah jendela lewat → boleh lagi', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('3') };
    const cooldownRepo = {
      get: vi.fn().mockResolvedValue({
        userId: '01USER',
        channel: 'word_comment',
        lastPushAt: new Date(Date.now() - 4 * 60_000),
      }),
      touch: vi.fn(),
    } as unknown as NotificationPushCooldownRepository;
    const gate = new WordCommentPushCooldownGate(settingsRepo as never, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
  });

  it('cooldown 0 → selalu boleh', async () => {
    const settingsRepo = { getValue: vi.fn().mockResolvedValue('0') };
    const cooldownRepo = {
      get: vi.fn(),
      touch: vi.fn(),
    } as unknown as NotificationPushCooldownRepository;
    const gate = new WordCommentPushCooldownGate(settingsRepo as never, cooldownRepo);
    await expect(gate.maySend('01USER')).resolves.toBe(true);
    expect(cooldownRepo.get).not.toHaveBeenCalled();
  });

  it('touchAfterSend menulis channel word_comment', async () => {
    const settingsRepo = { getValue: vi.fn() };
    const cooldownRepo = {
      get: vi.fn(),
      touch: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationPushCooldownRepository;
    const gate = new WordCommentPushCooldownGate(settingsRepo as never, cooldownRepo);
    await gate.touchAfterSend('01USER');
    expect(cooldownRepo.touch).toHaveBeenCalledWith('01USER', 'word_comment');
  });
});
