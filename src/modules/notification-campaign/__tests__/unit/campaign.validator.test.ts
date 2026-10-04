import { describe, expect, it } from 'vitest';

import {
  createCampaignBodySchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
} from '../../presentation/v1/validators/campaign.validator';

const base = {
  name: 'T',
  title: 'Judul',
  body: 'Isi',
};

describe('deep_link_value url whitelist', () => {
  it('menerima https://sambasku.com/...', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value: 'https://sambasku.com/id/donasi',
    });
    expect(r.success).toBe(true);
  });

  it('menerima https://play.google.com/...', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value:
        'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
    });
    expect(r.success).toBe(true);
  });

  it('menolak host luar', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value: 'https://attacker.example/phish',
    });
    expect(r.success).toBe(false);
  });

  it('menolak non-https', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value: 'http://sambasku.com/x',
    });
    expect(r.success).toBe(false);
  });

  it('menolak host mirip (suffix trick)', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value: 'https://sambasku.com.evil.io/x',
    });
    expect(r.success).toBe(false);
  });

  it('menolak url kosong untuk kind url', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'url',
      deep_link_value: null,
    });
    expect(r.success).toBe(false);
  });

  it('menerima deep_link_kind word (nilai bebas id)', () => {
    const r = createTemplateBodySchema.safeParse({
      ...base,
      deep_link_kind: 'word',
      deep_link_value: 'abc123',
    });
    expect(r.success).toBe(true);
  });

  it('updateTemplateBodySchema juga divalidasi', () => {
    const r = updateTemplateBodySchema.safeParse({
      deep_link_kind: 'url',
      deep_link_value: 'https://attacker.example/x',
    });
    expect(r.success).toBe(false);
  });

  it('createCampaignBodySchema inline juga divalidasi', () => {
    const r = createCampaignBodySchema.safeParse({
      title: 'Judul',
      body: 'Isi',
      deep_link_kind: 'url',
      deep_link_value: 'https://attacker.example/x',
    });
    expect(r.success).toBe(false);
  });

  it('createCampaignBodySchema tanpa deep link tetap lolos', () => {
    const r = createCampaignBodySchema.safeParse({
      title: 'Judul',
      body: 'Isi',
      audience_type: 'all',
    });
    expect(r.success).toBe(true);
  });
});
