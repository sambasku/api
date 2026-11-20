import { createHmac, timingSafeEqual } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  mintTurnCredentials,
  TURN_CREDENTIAL_TTL_SEC,
  TURN_URLS,
} from '../../infrastructure/mint-turn-credentials';

describe('mintTurnCredentials', () => {
  it('matches node:crypto HMAC-SHA1 base64 for coturn REST', async () => {
    const secret = 'test-turn-secret-do-not-use';
    const nowSec = 1_700_000_000;
    const result = await mintTurnCredentials(secret, {
      nowSec,
      ttlSec: TURN_CREDENTIAL_TTL_SEC,
      randomId: 'abcd1234',
    });

    expect(result.ttl).toBe(TURN_CREDENTIAL_TTL_SEC);
    expect(result.urls).toEqual([...TURN_URLS]);
    expect(result.username).toBe(`${nowSec + TURN_CREDENTIAL_TTL_SEC}:abcd1234`);

    const expected = createHmac('sha1', secret)
      .update(result.username)
      .digest('base64');
    const a = Buffer.from(result.credential);
    const b = Buffer.from(expected);
    expect(a.length).toBe(b.length);
    expect(timingSafeEqual(a, b)).toBe(true);
  });
});
