import { describe, expect, it } from 'vitest';
import { commentBodySchema } from '../../presentation/v1/validators/comment.validator';

describe('commentBodySchema', () => {
  it('menerima body teks dengan image: null (wire mobile freezed)', () => {
    const parsed = commentBodySchema.safeParse({ body: 'test', image: null });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.body).toBe('test');
    expect(parsed.data.image).toBeNull();
  });

  it('menerima body tanpa field image', () => {
    const parsed = commentBodySchema.safeParse({ body: 'test' });
    expect(parsed.success).toBe(true);
  });

  it('menolak kosong total (body kosong + image null)', () => {
    const parsed = commentBodySchema.safeParse({ body: '', image: null });
    expect(parsed.success).toBe(false);
  });
});
