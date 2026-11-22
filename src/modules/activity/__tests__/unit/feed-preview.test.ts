import { describe, expect, it } from 'vitest';
import {
  resolveFeedPreview,
  urlsFromImageJsonRows,
  urlsFromPhotoDedupeKey,
} from '../../application/utils/feed-preview';

describe('feed-preview', () => {
  it('urlsFromPhotoDedupeKey mengambil URL pertama dan count batch', () => {
    const key = 'place_photo:01PLACE:https://cdn.example/a.jpg|https://cdn.example/b.jpg';
    expect(urlsFromPhotoDedupeKey(key)).toEqual({
      url: 'https://cdn.example/a.jpg',
      count: 2,
    });
  });

  it('urlsFromPhotoDedupeKey abaikan prefix tidak cocok', () => {
    expect(urlsFromPhotoDedupeKey('contribution:word_image:x')).toEqual({
      url: null,
      count: 0,
    });
  });

  it('urlsFromImageJsonRows prefer public_url', () => {
    const rows = [{ url: 'https://stg/x', public_url: 'https://cdn/x' }];
    expect(urlsFromImageJsonRows(rows)).toEqual({ url: 'https://cdn/x', count: 1 });
  });

  it('resolveFeedPreview contribution_image', () => {
    const p = resolveFeedPreview({
      kind: 'contribution_image',
      wordImageUrl: 'https://cdn.example/word.jpg',
    });
    expect(p.previewImageUrl).toBe('https://cdn.example/word.jpg');
    expect(p.previewImageCount).toBeNull();
  });

  it('resolveFeedPreview komentar kata', () => {
    const p = resolveFeedPreview({
      kind: 'comment_created',
      wordCommentImagePublicUrl: 'https://cdn.example/c.jpg',
    });
    expect(p.previewImageUrl).toBe('https://cdn.example/c.jpg');
  });
});