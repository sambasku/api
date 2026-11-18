import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/shared/errors/app-error';
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when voice.room_enabled is off', async () => {
    settingsRepo.getByKeys.mockResolvedValue([
      { key: 'voice.room_enabled', value: 'false' },
    ]);
    const uc = new MintVoiceTokenUseCase(
      settingsRepo as never,
      userRepo as never,
    );
    await expect(uc.execute('u1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('mints token when flag on and env set', async () => {
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
    );
    const result = await uc.execute('u1');
    expect(result.url).toBe('wss://voice.example.com');
    expect(result.room).toBe('sambasku-global');
    expect(result.token.split('.')).toHaveLength(3);
  });
});
