import { describe, expect, it, vi } from 'vitest';
import { migrateJinyeImageRows } from '../../application/utils/migrate-jinye-images';

const IK = 'https://ik.imagekit.io/sambasku';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function deps(over: Partial<Parameters<typeof migrateJinyeImageRows>[1]> = {}) {
  return {
    imageKitEndpoint: IK,
    fetchBytes: vi.fn(async () => ({ bytes: PNG, mimeType: 'image/png' })),
    upload: vi.fn(async (i: { path: string }) => ({
      path: i.path,
      url: `https://cdn.jsdelivr.net/gh/sambasku/images@main/${i.path}`,
      sha: 'sha123',
    })),
    ...over,
  };
}

describe('migrateJinyeImageRows', () => {
  it('pindahkan foto ImageKit ke GitHub dan catat file lama untuk dihapus', async () => {
    const d = deps();
    const out = await migrateJinyeImageRows(
      [
        {
          url: `${IK}/jinye/a.png`,
          provider_file_id: 'kit1',
          public_url: `${IK}/jinye/a.png`,
          content_warnings: ['x'],
        },
      ],
      d,
    );
    expect(out.migrated).toBe(1);
    expect(out.failed).toBe(0);
    expect(out.legacyFileIds).toEqual(['kit1']);
    expect(out.images[0].provider_file_id).toMatch(/^assets\/jinye\/.+\.png$/);
    expect(out.images[0].public_url).toBe(out.images[0].url);
    expect(out.images[0].sha).toBe('sha123');
    expect(out.images[0].content_warnings).toEqual(['x']);
  });

  it('idempoten: baris GitHub dilewati tanpa unduh', async () => {
    const d = deps();
    const row = {
      url: 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/jinye/01A.jpg',
      provider_file_id: 'assets/jinye/01A.jpg',
      public_url: null,
    };
    const out = await migrateJinyeImageRows([row], d);
    expect(out.migrated).toBe(0);
    expect(out.images).toEqual([row]);
    expect(d.fetchBytes).not.toHaveBeenCalled();
  });

  it('tidak mengunduh host di luar ImageKit kita (SSRF)', async () => {
    const d = deps();
    const row = { url: 'http://169.254.169.254/x', provider_file_id: 'kit2', public_url: null };
    const out = await migrateJinyeImageRows([row], d);
    expect(out.failed).toBe(1);
    expect(out.images).toEqual([row]);
    expect(d.fetchBytes).not.toHaveBeenCalled();
  });

  it('gagal unduh: baris tetap ImageKit dan file lama tidak dihapus', async () => {
    const d = deps({ fetchBytes: vi.fn(async () => { throw new Error('boom'); }) });
    const row = { url: `${IK}/jinye/b.png`, provider_file_id: 'kit3', public_url: null };
    const out = await migrateJinyeImageRows([row], d);
    expect(out.failed).toBe(1);
    expect(out.legacyFileIds).toEqual([]);
    expect(out.images).toEqual([row]);
  });
});
