import { describe, expect, it, vi } from 'vitest';
import { removeJinyeSourcedWordImages } from '../../application/utils/remove-jinye-sourced-word-images';

describe('removeJinyeSourcedWordImages', () => {
  it('soft-delete lalu hapus file GitHub baris yang dibuang', async () => {
    const words = {
      softDeleteWordImagesFromJinye: vi.fn(async () => [
        { provider: 'github', providerFileId: 'assets/words/a.jpg', sha: 's1' },
        { provider: 'github', providerFileId: 'assets/words/b.jpg', sha: null },
        { provider: 'pexels', providerFileId: 'p1', sha: 's3' },
      ]),
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const n = await removeJinyeSourcedWordImages(
      { words: words as never, storage: storage as never },
      'J1',
      { onlyUnverified: true },
    );
    expect(n).toBe(3);
    expect(words.softDeleteWordImagesFromJinye).toHaveBeenCalledWith('J1', {
      onlyUnverified: true,
    });
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('assets/words/a.jpg', 's1');
  });

  it('tanpa repo: no-op', async () => {
    expect(await removeJinyeSourcedWordImages({}, 'J1', { onlyUnverified: false })).toBe(0);
  });
});
