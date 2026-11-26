import { BadRequestError } from '@/shared/errors/app-error';

export const MAX_ACHIEVEMENT_LOTTIE_BYTES = 2 * 1024 * 1024;

export type AchievementLottieKind = 'json' | 'dotlottie';

export interface ValidatedAchievementLottieFile {
  bytes: Uint8Array;
  mimeType: string;
  kind: AchievementLottieKind;
  size: number;
  filename: string | null;
}

function normalizeMime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  return base;
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  );
}

function looksLikeJsonText(bytes: Uint8Array): boolean {
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512));
  const trimmed = sample.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/** Lottie border: Bodymovin JSON atau arsip DotLottie (.lottie). */
export function validateAchievementLottieFile(input: {
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
}): ValidatedAchievementLottieFile {
  const filename = input.filename?.trim() || null;
  if (filename && (filename.includes('..') || filename.includes('\0'))) {
    throw new BadRequestError('VALIDATION_ERROR', 'Nama file tidak valid', [
      { field: 'file', message: 'Nama file tidak valid' },
    ]);
  }

  if (input.bytes.byteLength === 0) {
    throw new BadRequestError('VALIDATION_ERROR', 'File kosong', [
      { field: 'file', message: 'File tidak boleh kosong' },
    ]);
  }

  if (input.bytes.byteLength > MAX_ACHIEVEMENT_LOTTIE_BYTES) {
    throw new BadRequestError('IMAGE_TOO_LARGE', 'File Lottie terlalu besar (maks 2 MB)', [
      { field: 'file', message: 'Ukuran maksimal 2 MB' },
    ]);
  }

  const lowerName = filename?.toLowerCase() ?? '';
  const mime = normalizeMime(input.mimeType);

  let kind: AchievementLottieKind | null = null;
  if (lowerName.endsWith('.lottie') || looksLikeZip(input.bytes)) {
    if (!looksLikeZip(input.bytes) && !lowerName.endsWith('.lottie')) {
      throw new BadRequestError('VALIDATION_ERROR', 'Isi file .lottie tidak valid', [
        { field: 'file', message: 'File .lottie harus arsip zip' },
      ]);
    }
    kind = 'dotlottie';
  } else if (
    lowerName.endsWith('.json') ||
    mime === 'application/json' ||
    mime === 'text/json' ||
    looksLikeJsonText(input.bytes)
  ) {
    if (!looksLikeJsonText(input.bytes)) {
      throw new BadRequestError('VALIDATION_ERROR', 'JSON Lottie tidak valid', [
        { field: 'file', message: 'Isi file harus JSON Lottie (diawali { atau [)' },
      ]);
    }
    kind = 'json';
  }

  if (!kind) {
    throw new BadRequestError('VALIDATION_ERROR', 'Format Lottie tidak didukung', [
      { field: 'file', message: 'Hanya .json (Bodymovin) atau .lottie' },
    ]);
  }

  const mimeType =
    kind === 'dotlottie' ? 'application/octet-stream' : 'application/json';

  return {
    bytes: input.bytes,
    mimeType,
    kind,
    size: input.bytes.byteLength,
    filename,
  };
}