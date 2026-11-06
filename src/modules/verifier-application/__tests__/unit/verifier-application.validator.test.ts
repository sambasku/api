import { describe, it, expect } from 'vitest';
import { socialLinkSchema, submitVerifierApplicationSchema } from '../../presentation/v1/validators/verifier-application.validator';

const screenshot = {
  url: 'https://ik.imagekit.io/test/verifier-applications/budi.jpg',
  provider_file_id: 'file_va_budi',
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    full_name: 'Budi Santoso',
    phone: '81234567890',
    address: 'Jl. Merdeka No. 1, Sambas, Kalimantan Barat',
    social_links: [
      { platform: 'instagram', username: 'budi', screenshot },
    ],
    dialect: 'kota',
    reason: 'Saya ingin meninjau kata.',
    ...overrides,
  };
}

describe('socialLinkSchema - username + screenshot', () => {
  it('menerima item valid dan menyimpan username tanpa @', () => {
    const result = socialLinkSchema.safeParse({
      platform: 'instagram',
      username: '@budi',
      screenshot,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('budi');
      expect(result.data.screenshot.provider_file_id).toBe('file_va_budi');
    }
  });

  it('menolak username terlalu pendek setelah buang @', () => {
    const result = socialLinkSchema.safeParse({
      platform: 'instagram',
      username: '@a',
      screenshot,
    });
    expect(result.success).toBe(false);
  });

  it('menolak bentuk lama {platform, url}', () => {
    const result = socialLinkSchema.safeParse({
      platform: 'instagram',
      url: 'https://instagram.com/budi',
    });
    expect(result.success).toBe(false);
  });

  it('menolak screenshot tanpa provider_file_id', () => {
    const result = socialLinkSchema.safeParse({
      platform: 'instagram',
      username: 'budi',
      screenshot: { url: screenshot.url, provider_file_id: '' },
    });
    expect(result.success).toBe(false);
  });

  it('menolak screenshot.url yang bukan URL', () => {
    const result = socialLinkSchema.safeParse({
      platform: 'instagram',
      username: 'budi',
      screenshot: { url: 'bukan-url', provider_file_id: 'file_va_budi' },
    });
    expect(result.success).toBe(false);
  });
});

describe('submitVerifierApplicationSchema - social_links', () => {
  it('menerima body baru dan menormalkan HP', () => {
    const result = submitVerifierApplicationSchema.safeParse(body());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('6281234567890');
      expect(result.data.social_links[0]?.username).toBe('budi');
    }
  });

  it('menolak social_links kosong', () => {
    const result = submitVerifierApplicationSchema.safeParse(body({ social_links: [] }));
    expect(result.success).toBe(false);
  });

  it('nama lengkap kosong ditolak', () => {
    const result = submitVerifierApplicationSchema.safeParse(body({ full_name: ' ' }));
    expect(result.success).toBe(false);
  });

  it('alasan kurang dari 10 karakter ditolak', () => {
    const result = submitVerifierApplicationSchema.safeParse(body({ reason: 'pendek' }));
    expect(result.success).toBe(false);
  });

  it('dialek yang tidak dikirim menjadi umum', () => {
    const { dialect: _dialect, ...withoutDialect } = body();
    const result = submitVerifierApplicationSchema.safeParse(withoutDialect);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dialect).toBe('umum');
      expect(result.data.dialect_note).toBeNull();
    }
  });

  it('foto diri boleh kosong', () => {
    const result = submitVerifierApplicationSchema.safeParse(body());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.photo).toBeNull();
  });
});
