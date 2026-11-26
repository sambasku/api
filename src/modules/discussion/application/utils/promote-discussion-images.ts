import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { buildDiscussionImagePath } from '@/modules/public-image/application/utils/public-image-path';
import { validateImageFile } from '@/modules/public-image/application/utils/validate-image-file';
import { ValidationError } from '@/shared/errors/app-error';
import type { DiscussionImage } from '../../domain/entities/discussion.entity';

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new ValidationError([
      { field: 'images', message: 'Gagal mengunduh gambar staging untuk dipromosikan' },
    ]);
  }
  const buf = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    mimeType: res.headers.get('content-type'),
  };
}

export interface PromoteDiscussionImagesInput {
  images: DiscussionImage[];
  publicImageStorage: PublicImageStoragePort;
  imageStorage: ImageStoragePort;
  /** Bytes tersensor per indeks (opsional, jalur approve). */
  censoredFiles?: Uint8Array[];
  censoredMimeTypes?: (string | null)[];
  /** Peringatan visual per indeks; default pertahankan / kosong. */
  warningsByIndex?: string[][];
}

/**
 * Promosikan gambar staging ImageKit → GitHub publik.
 * Skip item yang sudah punya `publicUrl` (re-approve setelah sunting OP).
 */
export async function promoteDiscussionImages(
  input: PromoteDiscussionImagesInput,
): Promise<DiscussionImage[]> {
  const { images, publicImageStorage, imageStorage } = input;
  if (images.length === 0) return [];

  const promoted: DiscussionImage[] = [];
  const toDeleteStaging: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const staging = images[i];
    const warnings = input.warningsByIndex?.[i] ?? staging.contentWarnings ?? [];

    if (staging.publicUrl) {
      promoted.push({
        url: staging.url,
        providerFileId: staging.providerFileId,
        publicUrl: staging.publicUrl,
        contentWarnings: warnings,
      });
      continue;
    }

    const provided = input.censoredFiles?.[i];
    let bytes: Uint8Array;
    let mimeHint: string | null;

    if (provided && provided.byteLength > 0) {
      bytes = provided;
      mimeHint = input.censoredMimeTypes?.[i] ?? null;
    } else {
      const fetched = await fetchImageBytes(staging.url);
      bytes = fetched.bytes;
      mimeHint = fetched.mimeType;
    }

    const file = validateImageFile({ bytes, mimeType: mimeHint });
    const path = buildDiscussionImagePath(file.mimeType);
    const uploaded = await publicImageStorage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    promoted.push({
      url: staging.url,
      providerFileId: staging.providerFileId,
      publicUrl: uploaded.url,
      contentWarnings: warnings,
    });
    toDeleteStaging.push(staging.providerFileId);
  }

  for (const providerFileId of toDeleteStaging) {
    await imageStorage.deleteFile(providerFileId);
  }

  return promoted;
}
