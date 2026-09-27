/** Teks publik untuk akun yang sudah dihapus. Bukan username yang bisa dibuka. */
export const DELETED_ACCOUNT_LABEL = 'Akun tidak ditemukan';

export function publicAccountName(
  username: string | null | undefined,
  deletedAt: Date | null | undefined,
): string | null {
  if (!username) return null;
  if (deletedAt) return DELETED_ACCOUNT_LABEL;
  return username;
}

/** Nama tampilan publik; fallback ke username. Akun terhapus → label sama. */
export function publicAccountDisplayName(
  displayName: string | null | undefined,
  username: string | null | undefined,
  deletedAt: Date | null | undefined,
): string | null {
  if (deletedAt) return username || displayName ? DELETED_ACCOUNT_LABEL : null;
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  return publicAccountName(username, deletedAt);
}
