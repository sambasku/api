import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertVoiceRoomJoinAllowed,
  livekitHttpBase,
  VOICE_ROOM_MAX_PARTICIPANTS,
} from '../../infrastructure/livekit-room-service';

describe('livekitHttpBase', () => {
  it('maps wss to https and strips trailing slash', () => {
    expect(livekitHttpBase('wss://voice.example.com/')).toBe(
      'https://voice.example.com',
    );
    expect(livekitHttpBase('ws://localhost:7880')).toBe('http://localhost:7880');
  });
});

describe('assertVoiceRoomJoinAllowed', () => {
  const input = {
    wsUrl: 'wss://voice.example.com',
    apiKey: 'APItest',
    apiSecret: 'secret',
    room: 'lobby',
    identity: 'u-new',
    deviceId: 'device-a',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows join when under capacity', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('CreateRoom')) {
        return new Response('{}', { status: 200 });
      }
      return new Response(
        JSON.stringify({
          participants: Array.from({ length: 14 }, (_, i) => ({
            identity: `u${i}`,
          })),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(assertVoiceRoomJoinAllowed(input)).resolves.toBeUndefined();
  });

  it('rejects when room is full for a new identity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('CreateRoom')) {
          return new Response('{}', { status: 200 });
        }
        return new Response(
          JSON.stringify({
            participants: Array.from(
              { length: VOICE_ROOM_MAX_PARTICIPANTS },
              (_, i) => ({ identity: `u${i}` }),
            ),
          }),
          { status: 200 },
        );
      }),
    );
    await expect(assertVoiceRoomJoinAllowed(input)).rejects.toMatchObject({
      errorCode: 'VOICE_ROOM_FULL',
    });
  });

  it('allows remint when same device already in full room', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('CreateRoom')) {
          return new Response('{}', { status: 200 });
        }
        return new Response(
          JSON.stringify({
            participants: Array.from(
              { length: VOICE_ROOM_MAX_PARTICIPANTS },
              (_, i) => ({
                identity: i === 0 ? 'u-new' : `u${i}`,
                metadata: i === 0 ? JSON.stringify({ d: 'device-a' }) : undefined,
              }),
            ),
          }),
          { status: 200 },
        );
      }),
    );
    await expect(assertVoiceRoomJoinAllowed(input)).resolves.toBeUndefined();
  });

  it('rejects when identity already seated on another device', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('CreateRoom')) {
          return new Response('{}', { status: 200 });
        }
        return new Response(
          JSON.stringify({
            participants: [
              {
                identity: 'u-new',
                metadata: JSON.stringify({ d: 'device-b' }),
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    await expect(assertVoiceRoomJoinAllowed(input)).rejects.toMatchObject({
      errorCode: 'VOICE_ALREADY_JOINED',
    });
  });

  it('throws VOICE_UNAVAILABLE when LiveKit times out / unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      }),
    );
    await expect(assertVoiceRoomJoinAllowed(input)).rejects.toMatchObject({
      errorCode: 'VOICE_UNAVAILABLE',
    });
  });
});
