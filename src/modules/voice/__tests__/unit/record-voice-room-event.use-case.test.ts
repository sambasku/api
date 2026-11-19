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

  it('writes system chat on joined', async () => {
    const events = { insert: vi.fn().mockResolvedValue(undefined) };
    const chatRepo = {
      create: vi.fn().mockResolvedValue({ id: 'm1', kind: 'system' }),
    };
    const chatMirror = { upsert: vi.fn().mockResolvedValue(undefined) };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'u1',
        username: 'rani',
        displayName: 'Rani',
        avatarUrl: null,
      }),
    };
    const uc = new RecordVoiceRoomEventUseCase(
      events as never,
      chatRepo as never,
      chatMirror as never,
      userRepo as never,
    );
    await uc.execute({ userId: 'u1', kind: 'joined' });
    expect(chatRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        kind: 'system',
        body: 'bergabung ke voice room',
        username: 'rani',
        displayName: 'Rani',
        stickerId: null,
        replyToId: null,
      }),
    );
    expect(chatMirror.upsert).toHaveBeenCalled();
  });

  it('writes system chat on left', async () => {
    const events = { insert: vi.fn().mockResolvedValue(undefined) };
    const chatRepo = {
      create: vi.fn().mockResolvedValue({ id: 'm2', kind: 'system' }),
    };
    const chatMirror = { upsert: vi.fn().mockResolvedValue(undefined) };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'u1',
        username: 'budi',
        displayName: 'Budi',
        avatarUrl: null,
      }),
    };
    const uc = new RecordVoiceRoomEventUseCase(
      events as never,
      chatRepo as never,
      chatMirror as never,
      userRepo as never,
    );
    await uc.execute({ userId: 'u1', kind: 'left' });
    expect(chatRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'system',
        body: 'keluar dari voice room',
      }),
    );
  });

  it('does not write chat on disconnect', async () => {
    const events = { insert: vi.fn().mockResolvedValue(undefined) };
    const chatRepo = { create: vi.fn() };
    const chatMirror = { upsert: vi.fn() };
    const userRepo = { findById: vi.fn() };
    const uc = new RecordVoiceRoomEventUseCase(
      events as never,
      chatRepo as never,
      chatMirror as never,
      userRepo as never,
    );
    await uc.execute({ userId: 'u1', kind: 'disconnect' });
    expect(chatRepo.create).not.toHaveBeenCalled();
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('keeps analytics when chat mirror fails', async () => {
    const events = { insert: vi.fn().mockResolvedValue(undefined) };
    const chatRepo = {
      create: vi.fn().mockRejectedValue(new Error('db down')),
    };
    const chatMirror = { upsert: vi.fn() };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'u1',
        username: 'rani',
        displayName: 'Rani',
        avatarUrl: null,
      }),
    };
    const uc = new RecordVoiceRoomEventUseCase(
      events as never,
      chatRepo as never,
      chatMirror as never,
      userRepo as never,
    );
    const result = await uc.execute({ userId: 'u1', kind: 'joined' });
    expect(result.kind).toBe('joined');
    expect(events.insert).toHaveBeenCalled();
    expect(chatMirror.upsert).not.toHaveBeenCalled();
  });
});
