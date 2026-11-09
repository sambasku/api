import { describe, it, expect } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import {
  assertPantunAudioDurationMs,
  PANTUN_AUDIO_MAX_MS,
  PANTUN_AUDIO_MIN_MS,
} from '../../application/utils/pantun-audio-duration';

describe('assertPantunAudioDurationMs', () => {
  it('menerima 10s dan 60s', () => {
    expect(assertPantunAudioDurationMs(PANTUN_AUDIO_MIN_MS)).toBe(10_000);
    expect(assertPantunAudioDurationMs(PANTUN_AUDIO_MAX_MS)).toBe(60_000);
    expect(assertPantunAudioDurationMs('15000')).toBe(15_000);
  });

  it('tolak di bawah 10s', () => {
    expect(() => assertPantunAudioDurationMs(9999)).toThrow(ValidationError);
  });

  it('tolak di atas 60s', () => {
    expect(() => assertPantunAudioDurationMs(60_001)).toThrow(ValidationError);
  });

  it('tolak kosong / NaN', () => {
    expect(() => assertPantunAudioDurationMs(undefined)).toThrow(ValidationError);
    expect(() => assertPantunAudioDurationMs('abc')).toThrow(ValidationError);
  });
});
