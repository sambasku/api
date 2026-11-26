import { validateImageFile, MAX_IMAGE_BYTES } from '@/modules/public-image/application/utils/validate-image-file';
import { buildJinyeImagePath } from '@/modules/public-image/application/utils/public-image-path';
import type { JinyeImageRow } from '@/shared/database/drizzle/schema/jinye.schema';
import { isTrustedJinyeImage, jinyeImageProvider } from './jinye-image-trust';

export interface MigrateJinyeImagesDeps {
  /** Unduh bytes dari URL ImageKit lama (sudah dibatasi ukuran + timeout). */
  fetchBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }>;
  upload(input: {
    path: string;
    content: Uint8Array;
    mimeType: string;
  }): Promise<{ path: string; url: string; sha: string }>;
  /** Host ImageKit milik kita; URL lain tidak pernah diunduh. */
  imageKitEndpoint: string | undefined;
}

export interface MigrateJinyeImagesResult {
  images: JinyeImageRow[];
  /** Jumlah foto yang berhasil dipindah ke GitHub. */
  migrated: number;
  /** Foto ImageKit yang tidak dipindah (URL tak tepercaya / gagal). */
  failed: number;
  /** providerFileId ImageKit yang boleh dihapus SETELAH DB berhasil diubah. */
  legacyFileIds: string[];
  /** Path GitHub baru; hapus kalau update DB gagal (hindari file yatim). */
  uploaded: { path: string; sha: string }[];
}

/**
 * Pindahkan foto Jinye ImageKit -> repo GitHub. Idempoten: baris `assets/...`
 * dilewati. Baris gagal dibiarkan apa adanya (tetap ImageKit) supaya bisa
 * diulang tanpa kehilangan foto.
 */
export async function migrateJinyeImageRows(
  rows: JinyeImageRow[],
  deps: MigrateJinyeImagesDeps,
): Promise<MigrateJinyeImagesResult> {
  const out: JinyeImageRow[] = [];
  const legacyFileIds: string[] = [];
  const uploaded: { path: string; sha: string }[] = [];
  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    if (jinyeImageProvider(row.provider_file_id) === 'github') {
      out.push(row);
      continue;
    }
    const fetchUrl = row.public_url?.trim() || row.url;
    if (
      !isTrustedJinyeImage(
        { url: fetchUrl, providerFileId: row.provider_file_id },
        deps.imageKitEndpoint,
      )
    ) {
      failed += 1;
      out.push(row);
      continue;
    }
    try {
      const fetched = await deps.fetchBytes(fetchUrl);
      const file = validateImageFile({ bytes: fetched.bytes, mimeType: fetched.mimeType });
      const stored = await deps.upload({
        path: buildJinyeImagePath(file.mimeType),
        content: file.bytes,
        mimeType: file.mimeType,
      });
      uploaded.push({ path: stored.path, sha: stored.sha });
      legacyFileIds.push(row.provider_file_id);
      out.push({
        ...row,
        url: stored.url,
        provider_file_id: stored.path,
        public_url: stored.url,
        sha: stored.sha,
      });
      migrated += 1;
    } catch {
      failed += 1;
      out.push(row);
    }
  }

  return { images: out, migrated, failed, legacyFileIds, uploaded };
}

/** Unduh dengan batas 5 MB + timeout; dipakai script backfill dan promote. */
export async function fetchImageBytesLimited(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const maxBytes = opts.maxBytes ?? MAX_IMAGE_BYTES;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    redirect: 'error',
  });
  if (!res.ok) {
    throw new Error(`fetch gambar gagal: ${res.status}`);
  }
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    throw new Error('gambar melebihi batas ukuran');
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('respons gambar kosong');
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('gambar melebihi batas ukuran');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { bytes, mimeType: res.headers.get('content-type') };
}
