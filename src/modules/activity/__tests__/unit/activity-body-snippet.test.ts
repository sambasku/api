import { describe, expect, it } from 'vitest';
import {
  commentFeedPayload,
  discussionCreatedPayload,
  snippetActivityBody,
} from '../../application/utils/activity-body-snippet';

describe('activity-body-snippet', () => {
  it('snippetActivityBody memotong dengan ellipsis ASCII', () => {
    const long = 'a'.repeat(130);
    expect(snippetActivityBody(long, 120)).toBe(`${'a'.repeat(119)}…`);
  });

  it('discussionCreatedPayload fallback ruang diskusi', () => {
    expect(discussionCreatedPayload('   ')).toBe('Membuka ruang diskusi');
  });

  it('commentFeedPayload prioritas teks lalu media', () => {
    expect(commentFeedPayload({ body: '  halo dunia  ' })).toBe('halo dunia');
    expect(commentFeedPayload({ stickerId: 'stk' })).toBe('Stiker');
    expect(commentFeedPayload({ hasImage: true })).toBe('Foto');
    expect(commentFeedPayload({ hasAudio: true })).toBe('Rekaman suara');
    expect(commentFeedPayload({})).toBe('…');
  });
});