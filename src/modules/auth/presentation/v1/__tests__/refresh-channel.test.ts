import { describe, it, expect } from 'vitest';
import { isBrowserClient } from '../refresh-channel';

describe('isBrowserClient', () => {
  it('Origin ada → browser (POST dari browser selalu kirim Origin)', () => {
    expect(isBrowserClient({ origin: 'https://sambasku.com' })).toBe(true);
  });

  it('User-Agent pola browser → browser', () => {
    expect(
      isBrowserClient({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }),
    ).toBe(true);
    expect(isBrowserClient({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
  });

  it('UA Dio/flutter/dart + tanpa Origin → bukan browser (jalur body mobile)', () => {
    expect(isBrowserClient({ 'user-agent': 'Dio/5.4 (dart:io)' })).toBe(false);
    expect(isBrowserClient({ 'user-agent': 'Dart/3.4 (dart:io)' })).toBe(false);
    expect(isBrowserClient({ 'user-agent': 'okhttp/4.12.0' })).toBe(false);
  });

  it('tanpa header sama sekali → bukan browser (native app)', () => {
    expect(isBrowserClient({})).toBe(false);
  });
});
