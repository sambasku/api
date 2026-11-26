import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';

/**
 * Batalkan foto lemma hasil promote Jinye (soft-delete) dan hapus file GitHub-nya.
 * archive/delete Jinye: `onlyUnverified` (yang sudah tayang tetap jadi milik lemma).
 * takedown: semua (foto yang dilarang tidak boleh tersisa di lemma).
 */
export async function removeJinyeSourcedWordImages(
  deps: {
    words?: Partial<Pick<WordRepository, 'softDeleteWordImagesFromJinye'>>;
    storage?: PublicImageStoragePort;
  },
  jinyeId: string,
  opts: { onlyUnverified: boolean },
): Promise<number> {
  if (!deps.words?.softDeleteWordImagesFromJinye) return 0;
  const removed = await deps.words.softDeleteWordImagesFromJinye(jinyeId, opts);
  if (deps.storage) {
    for (const img of removed) {
      if (img.provider === 'github' && img.sha) {
        await deps.storage.delete(img.providerFileId, img.sha);
      }
    }
  }
  return removed.length;
}
