import { describe, expect, it } from 'vitest';
import { createSuggestionSchema } from '../../presentation/v1/validators/suggestion.validator';

describe('createSuggestionSchema images', () => {
  it('menerima provider imagekit pada action=add', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'image_issue',
      proposed_changes: {
        images: [
          {
            action: 'add',
            url: 'https://ik.imagekit.io/demo/words/a.jpg',
            provider: 'imagekit',
            provider_file_id: 'file_abc',
            is_primary: false,
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('menerima stock pexels', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'image_issue',
      proposed_changes: {
        images: [
          {
            action: 'add',
            url: 'https://images.pexels.com/photos/1/food.jpg',
            provider: 'pexels',
            provider_file_id: 'pexels-1',
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('menerima alt_text null (upload kamera/galeri tanpa alt)', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'image_issue',
      proposed_changes: {
        images: [
          {
            action: 'add',
            url: 'https://ik.imagekit.io/demo/words/a.jpg',
            provider: 'imagekit',
            provider_file_id: 'file_abc',
            alt_text: null,
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('menerima attribution stock Unsplash pada action=add', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'add_photo',
      proposed_changes: {
        images: [
          {
            action: 'add',
            url: 'https://images.unsplash.com/photo-1',
            provider: 'unsplash',
            provider_file_id: 'unsplash-1',
            attribution: {
              name: 'Ada',
              url: 'https://unsplash.com/@ada',
              license: 'Unsplash License',
              license_url: 'https://unsplash.com/license',
              source: 'unsplash',
            },
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('menolak attribution.url non-https', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'add_photo',
      proposed_changes: {
        images: [
          {
            action: 'add',
            url: 'https://images.unsplash.com/photo-1',
            provider: 'unsplash',
            provider_file_id: 'unsplash-1',
            attribution: {
              name: 'Ada',
              url: 'http://unsplash.com/@ada',
            },
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });
});
