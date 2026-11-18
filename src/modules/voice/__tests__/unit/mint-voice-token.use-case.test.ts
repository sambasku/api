import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import { MintVoiceTokenUseCase } from '../../application/mint-voice-token.use-case';

vi.mock('@/shared/config/env', () => ({
  env: {
    LIVEKIT_URL: 'wss://voice.example.com',
    LIVEKIT_API_KEY: 'APItest',
    LIVEKIT_API_SECRET: 'secret',
    LIVEKIT_ROOM_NAME: 'sambasku-global',
  },
}));

describe('MintVoiceTokenUseCase', () => {
  const settingsRepo = {
    getByKeys: vi.fn(),
  };
  const userRepo = {
    findById: vi.fn(),
  };
  const roomGate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    roomGate.mockResolvedValue(undefined);
  });

  it('throws when voice.room_enabled is off', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'false' },
    ]);
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
      roomGate,
    );
    await expect(uc.execute('u1', 'dev-a')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(roomGate).not.toHaveBeenCalled();
  });

  it('mints token when flag on, env set, and room gate ok', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'true' },
    ]);
    userRepo.findById.mockResolvedValue({
      displayName: 'Budi',
      username: 'budi',
    });
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
      roomGate,
    );
    const result = await uc.execute('u1', 'dev-a');
    expect(result.url).toBe('wss://voice.example.com');
    expect(result.room).toBe('sambasku-global');
    expect(result.maxParticipants).toBe(15);
    expect(result.token.split('.')).toHaveLength(3);
    expect(roomGate).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: 'u1',
        deviceId: 'dev-a',
        room: 'sambasku-global',
        maxParticipants: 15,
      }),
    );
  });

  it('rejects when device id missing', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'true' },
    ]);
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
      roomGate,
    );
    await expect(uc.execute('u1', '  ')).rejects.toMatchObject({
      errorCode: 'DEVICE_ID_REQUIRED',
    });
    expect(roomGate).not.toHaveBeenCalled();
  });

  it('propagates VOICE_ROOM_FULL from room gate', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'true' },
    ]);
    roomGate.mockRejectedValue(
      new ConflictError('VOICE_ROOM_FULL', 'penuh', { max: 15, count: 15 }),
    );
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
      roomGate,
    );
    await expect(uc.execute('u1', 'dev-a')).rejects.toMatchObject({
      errorCode: 'VOICE_ROOM_FULL',
    });
  });

  it('propagates VOICE_UNAVAILABLE when homelab unreachable', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'true' },
    ]);
    roomGate.mockRejectedValue(
      new ServiceUnavailableError(
        'VOICE_UNAVAILABLE',
        'Voice server tidak terjangkau. Coba lagi nanti ya.',
      ),
    );
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
      roomGate,
    );
    await expect(uc.execute('u1', 'dev-a')).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
