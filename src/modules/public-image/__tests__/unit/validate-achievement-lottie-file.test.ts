import { describe, expect, it } from 'vitest';
import { validateAchievementLottieFile } from '../../application/utils/validate-achievement-lottie-file';

describe('validateAchievementLottieFile', () => {
  it('menerima JSON Lottie valid', () => {
    const bytes = new TextEncoder().encode('{"v":"5.5.7","layers":[]}');
    const out = validateAchievementLottieFile({
      bytes,
      mimeType: 'application/json',
      filename: 'border.json',
    });
    expect(out.kind).toBe('json');
  });

  it('menerima basename dengan .. di tengah nama (bukan path traversal)', () => {
    const bytes = new TextEncoder().encode('{"v":"5.5.7","layers":[]}');
    const out = validateAchievementLottieFile({
      bytes,
      mimeType: 'application/json',
      filename: 'border..v2.json',
    });
    expect(out.kind).toBe('json');
    expect(out.filename).toBe('border..v2.json');
  });

  it('menolak file bukan Lottie', () => {
    const bytes = new TextEncoder().encode('not-json');
    expect(() =>
      validateAchievementLottieFile({
        bytes,
        mimeType: 'text/plain',
        filename: 'x.txt',
      }),
    ).toThrow();
  });
});