import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { BadRequestError } from '@/shared/errors/app-error';
import type { UserLookupPort } from '../ports/user-lookup.port';

/**
 * Default: Pengimpor Data CSV.
 * Jika admin memilih user, atribusi kata/sesi mengarah ke user itu.
 */
export async function resolveImportAttributedTo(
  lookup: UserLookupPort,
  attributedTo: string | null | undefined,
): Promise<string> {
  const id = attributedTo?.trim();
  if (!id) return CSV_IMPORTER_USER_ID;
  const user = await lookup.findById(id);
  if (!user) {
    throw new BadRequestError('IMPORT_USER', 'User atribusi tidak ditemukan. Pilih ulang dari daftar.');
  }
  if (!user.isActive) {
    throw new BadRequestError('IMPORT_USER', 'User atribusi tidak aktif. Pilih user lain.');
  }
  return user.id;
}
