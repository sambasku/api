/** Basename aman dari nilai multipart; tolak traversal, izinkan `..` di tengah nama. */
export function sanitizeUploadFilename(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  if (raw.includes('\0')) return null;
  const base = raw.replace(/\\/g, '/').trim().split('/').pop()?.trim() ?? '';
  if (!base || base === '.' || base === '..') return null;
  return base;
}