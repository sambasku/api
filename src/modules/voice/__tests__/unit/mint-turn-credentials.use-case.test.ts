import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '@/shared/errors/app-error';
import { MintTurnCredentialsUseCase } from '../../application/mint-turn-credentials.use-case';
import { TURN_URLS } from '../../infrastructure/mint-turn-credentials';

const { envState } = vi.hoisted(() => ({
  envState: {
    TURN_SECRET: 'test-turn-secret' as string | undefined,
  },
}));

vi.mock('@/shared/config/env', () => ({
  env: envState,
}));

describe('MintTurnCredentialsUseCase', () => {
  beforeEach(() => {
    envState.TURN_SECRET = 'test-turn-secret';
  });

  it('throws TURN_UNAVAILABLE when secret missing', async () => {
    envState.TURN_SECRET = undefined;
    const uc = new MintTurnCredentialsUseCase();
    await expect(uc.execute()).rejects.toMatchObject({
      errorCode: 'TURN_UNAVAILABLE',
    });
    await expect(uc.execute()).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('returns urls username credential ttl when secret set', async () => {
    const uc = new MintTurnCredentialsUseCase();
    const result = await uc.execute();
    expect(result.urls).toEqual([...TURN_URLS]);
    expect(result.ttl).toBe(86_400);
    expect(result.username).toMatch(/^\d+:[0-9a-f]{8}$/i);
    expect(result.credential.length).toBeGreaterThan(10);
  });
});
