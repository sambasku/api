import { describe, expect, it, vi } from 'vitest';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { BadRequestError } from '@/shared/errors/app-error';
import { resolveImportAttributedTo } from '../../application/utils/resolve-import-attribution';

describe('resolveImportAttributedTo', () => {
  it('default ke Pengimpor Data CSV bila tidak dipilih', async () => {
    const lookup = { findById: vi.fn() };
    await expect(resolveImportAttributedTo(lookup, undefined)).resolves.toBe(CSV_IMPORTER_USER_ID);
    await expect(resolveImportAttributedTo(lookup, null)).resolves.toBe(CSV_IMPORTER_USER_ID);
    await expect(resolveImportAttributedTo(lookup, '  ')).resolves.toBe(CSV_IMPORTER_USER_ID);
    expect(lookup.findById).not.toHaveBeenCalled();
  });

  it('mengembalikan user aktif yang dipilih', async () => {
    const lookup = {
      findById: vi.fn().mockResolvedValue({ id: '01USERATTRIBUTIONTEST01', isActive: true }),
    };
    await expect(resolveImportAttributedTo(lookup, '01USERATTRIBUTIONTEST01')).resolves.toBe(
      '01USERATTRIBUTIONTEST01',
    );
  });

  it('menolak user yang tidak ditemukan', async () => {
    const lookup = { findById: vi.fn().mockResolvedValue(null) };
    await expect(resolveImportAttributedTo(lookup, '01USERATTRIBUTIONTEST01')).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('menolak user tidak aktif', async () => {
    const lookup = {
      findById: vi.fn().mockResolvedValue({ id: '01USERATTRIBUTIONTEST01', isActive: false }),
    };
    await expect(resolveImportAttributedTo(lookup, '01USERATTRIBUTIONTEST01')).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
