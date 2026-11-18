import { createHmac, timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mintLivekitAccessToken } from '../../infrastructure/livekit-token';

describe('mintLivekitAccessToken', () => {
  it('signs HS256 JWT with LiveKit video grants', async () => {
    const apiKey = 'APItest';
    const apiSecret = 'test-secret-do-not-use';
    const token = await mintLivekitAccessToken({
      identity: 'user-1',
      name: 'Tester',
      room: 'lobby',
      apiKey,
      apiSecret,
      ttlSec: 3600,
    });

    const [header, payload, sig] = token.split('.');
    expect(header).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(sig).toBeTruthy();

    const expected = createHmac('sha256', apiSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    expect(a.length).toBe(b.length);
    expect(timingSafeEqual(a, b)).toBe(true);

    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as {
      iss: string;
      sub: string;
      name: string;
      video: {
        room: string;
        roomJoin: boolean;
        canPublish: boolean;
        canSubscribe: boolean;
        canPublishData: boolean;
      };
      exp: number;
    };
    expect(claims.iss).toBe(apiKey);
    expect(claims.sub).toBe('user-1');
    expect(claims.name).toBe('Tester');
    expect(claims.video.room).toBe('lobby');
    expect(claims.video.roomJoin).toBe(true);
    expect(claims.video.canPublish).toBe(true);
    expect(claims.video.canSubscribe).toBe(true);
    expect(claims.video.canPublishData).toBe(true);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
