/**
 * LiveKit RoomService (Twirp HTTP) - kapasitas + health gate sebelum mint JWT.
 *
 * Homelab sering down: semua panggilan punya timeout ketat. Gagal reach →
 * lempar ServiceUnavailable (jangan mint token ke server mati).
 */
import {
  ConflictError,
  ServiceUnavailableError,
} from '@/shared/errors/app-error';
import { mintLivekitServerToken } from './livekit-token';

/** Soft + CreateRoom hard ceiling. Jangan naikkan tanpa kapasitas SFU. */
export const VOICE_ROOM_MAX_PARTICIPANTS = 15;

/** Timeout Twirp ke homelab - lebih baik gagal cepat daripada hang Worker. */
const LIVEKIT_HTTP_TIMEOUT_MS = 3_000;

export interface LivekitRoomGateInput {
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
  room: string;
  identity: string;
  maxParticipants?: number;
}

export function livekitHttpBase(wsUrl: string): string {
  return wsUrl
    .trim()
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/$/, '');
}

async function twirp<T>(
  base: string,
  method: string,
  body: Record<string, unknown>,
  bearer: string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVEKIT_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/twirp/livekit.RoomService/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new ServiceUnavailableError(
          'VOICE_UNAVAILABLE',
          'Voice server balas tidak valid. Coba lagi nanti ya.',
        );
      }
    }
    if (!res.ok) {
      const msg =
        typeof json.msg === 'string'
          ? json.msg
          : typeof json.message === 'string'
            ? json.message
            : `LiveKit ${method} HTTP ${res.status}`;
      // room not found → biarkan caller treat sebagai kosong
      if (
        res.status === 404 ||
        /not found|does not exist|roomdoesnotexist/i.test(msg)
      ) {
        const err = new Error(msg) as Error & { code?: string };
        err.code = 'ROOM_NOT_FOUND';
        throw err;
      }
      throw new ServiceUnavailableError(
        'VOICE_UNAVAILABLE',
        'Voice server lagi bermasalah. Coba lagi nanti ya.',
      );
    }
    return json as T;
  } catch (e) {
    if (e instanceof ServiceUnavailableError) throw e;
    if (e instanceof Error && (e as { code?: string }).code === 'ROOM_NOT_FOUND') {
      throw e;
    }
    // Abort / network / DNS
    throw new ServiceUnavailableError(
      'VOICE_UNAVAILABLE',
      'Voice server tidak terjangkau. Coba lagi nanti ya.',
    );
  } finally {
    clearTimeout(timer);
  }
}

interface ListParticipantsResponse {
  participants?: Array<{ identity?: string }>;
}

/**
 * Pastikan room ada (max peserta) + tolak mint jika penuh
 * (kecuali identity sudah di dalam - remint reconnect).
 */
export async function assertVoiceRoomJoinAllowed(
  input: LivekitRoomGateInput,
): Promise<void> {
  const max = input.maxParticipants ?? VOICE_ROOM_MAX_PARTICIPANTS;
  const base = livekitHttpBase(input.wsUrl);
  if (!base.startsWith('http')) {
    throw new ServiceUnavailableError(
      'VOICE_UNAVAILABLE',
      'URL voice server tidak valid.',
    );
  }

  const bearer = await mintLivekitServerToken({
    apiKey: input.apiKey,
    apiSecret: input.apiSecret,
    ttlSec: 60,
  });

  // CreateRoom idempotent: set max_participants untuk room baru.
  try {
    await twirp(base, 'CreateRoom', {
      name: input.room,
      max_participants: max,
      empty_timeout: 300,
    }, bearer);
  } catch (e) {
    // Create gagal keras (bukan not-found) → server bermasalah
    if (e instanceof ServiceUnavailableError) throw e;
  }

  let participants: Array<{ identity?: string }> = [];
  try {
    const listed = await twirp<ListParticipantsResponse>(
      base,
      'ListParticipants',
      { room: input.room },
      bearer,
    );
    participants = listed.participants ?? [];
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === 'ROOM_NOT_FOUND') {
      participants = [];
    } else if (e instanceof ServiceUnavailableError) {
      throw e;
    } else {
      throw new ServiceUnavailableError(
        'VOICE_UNAVAILABLE',
        'Voice server tidak terjangkau. Coba lagi nanti ya.',
      );
    }
  }

  const alreadyIn = participants.some((p) => p.identity === input.identity);
  if (!alreadyIn && participants.length >= max) {
    throw new ConflictError(
      'VOICE_ROOM_FULL',
      `Voice room penuh (maks ${max} orang). Coba lagi nanti ya.`,
      { max, count: participants.length },
    );
  }
}
