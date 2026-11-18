import { ValidationError } from '@/shared/errors/app-error';
import type { StickerRepository } from '@/modules/sticker/domain/repositories/sticker.repository';

export async function resolveCommentStickerId(input: {
  rawStickerId: string | null | undefined;
  stickerRepo: StickerRepository | undefined;
}): Promise<string | null> {
  const rawSticker = input.rawStickerId?.trim() ?? '';
  if (!rawSticker) return null;
  if (!input.stickerRepo) {
    throw new ValidationError([
      { field: 'sticker_id', message: 'Stiker tidak tersedia' },
    ]);
  }
  const catalog = await input.stickerRepo.findActiveById(rawSticker);
  if (!catalog) {
    throw new ValidationError([
      {
        field: 'sticker_id',
        message: 'Stiker tidak tersedia. Pilih ulang dari daftar.',
      },
    ]);
  }
  return catalog.id;
}