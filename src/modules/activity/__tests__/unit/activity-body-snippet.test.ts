import { describe, it, expect } from 'vitest';
import {
  discussionCreatedPayload,
  jinyeFeedPayload,
  snippetActivityBody,
} from '../../application/utils/activity-body-snippet';

describe('activity-body-snippet', () => {
  it('snippet memotong di max dengan ellipsis', () => {
    const long = 'a'.repeat(130);
    expect(snippetActivityBody(long, 120)).toBe(`${'a'.repeat(119)}…`);
  });

  it('discussionCreatedPayload: isi atau fallback', () => {
    expect(discussionCreatedPayload('  Halo dunia  ')).toBe('Halo dunia');
    expect(discussionCreatedPayload(null)).toBe('Membuka ruang diskusi');
    expect(discussionCreatedPayload('')).toBe('Membuka ruang diskusi');
    expect(discussionCreatedPayload('   ')).toBe('Membuka ruang diskusi');
  });

  it('jinyeFeedPayload: teks → Foto → Suara → Jinye', () => {
    expect(
      jinyeFeedPayload({
        body: '  Halo Sambas  ',
        imageCount: 2,
        hasAudio: true,
      }),
    ).toBe('Jinye : Halo Sambas');
    expect(jinyeFeedPayload({ quoteBody: 'Kutipan' })).toBe('Jinye : Kutipan');
    expect(jinyeFeedPayload({ imageCount: 1 })).toBe('Jinye : Foto');
    expect(jinyeFeedPayload({ hasAudio: true })).toBe('Jinye : Suara');
    expect(jinyeFeedPayload({})).toBe('Jinye');
  });
});

