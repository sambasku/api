import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '@/shared/errors/app-error';
import { RecordVoiceRoomEventUseCase } from '../../application/record-voice-room-event.use-case';

describe('RecordVoiceRoomEventUseCase', () => {
  it('rejects unknown kind', async () => {
    const events = { insert: vi.fn() };
    const uc = new RecordVoiceRoomEventUseCase(events as never);
    await expect(
      uc.execute({ userId: 'u1', kind: 'boom' }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(events.insert).not.toHaveBeenCalled();
  });

  it('inserts joined event with clipped detail', async () => {
    const events = { insert: vi.fn().mockResolvedValue(undefined) };
    const uc = new RecordVoiceRoomEventUseCase(events as never);
    const result = await uc.execute({
      userId: 'u1',
      kind: 'joined',
      room: 'sambasku-global',
      platform: 'android',
      detail: 'x'.repeat(300),
    });
    expect(result.kind).toBe('joined');
    expect(events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        kind: 'joined',
        room: 'sambasku-global',
        platform: 'android',
        detail: 'x'.repeat(240),
      }),
    );
  });
});
