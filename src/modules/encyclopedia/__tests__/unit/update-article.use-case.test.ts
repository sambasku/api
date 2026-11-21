import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateArticleUseCase } from '../../application/use-cases/article.use-cases';

const NOW = new Date('2026-10-01T00:00:00Z');
const COVER_A = 'https://ik.imagekit.io/sambasku/cover-a.jpg';
const COVER_B = 'https://ik.imagekit.io/sambasku/cover-b.jpg';

const existing = {
  id: '01ARTICLEULID000000000001',
  slug: 'sejarah-istana',
  title: 'Sejarah Istana',
  excerpt: 'Ringkas.',
  bodyMd: 'Isi artikel.',
  bodyText: 'Isi artikel.',
  coverUrl: COVER_A,
  categoryId: 'sejarah',
  categoryName: 'Sejarah',
  sourceUrl: null,
  referencesMd: null,
  authorUserId: '01USERULID000000000000001',
  authorUsername: 'penulis',
  authorDisplayName: 'Penulis',
  authorAvatarUrl: null,
  authorDeletedAt: null,
  authorRole: null,
  status: 'published' as const,
  tags: ['istana'],
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

function makeRepo(over: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(existing),
    listCategories: vi.fn().mockResolvedValue([
      { id: 'sejarah', status: 'published' },
    ]),
    updateWithRevision: vi.fn().mockImplementation(async (input) => ({
      ...existing,
      ...input.patch,
      updatedAt: new Date('2026-10-02T00:00:00Z'),
    })),
    ...over,
  };
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

function baseInput(over: Record<string, unknown> = {}) {
  return {
    title: existing.title,
    excerpt: existing.excerpt,
    bodyMd: existing.bodyMd,
    categoryId: existing.categoryId,
    tags: [...existing.tags],
    coverUrl: existing.coverUrl,
    sourceUrl: existing.sourceUrl,
    referencesMd: existing.referencesMd,
    editorId: '01EDITORULID000000000001',
    ...over,
  };
}

describe('UpdateArticleUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hanya ganti cover_url: tetap menulis revisi', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const uc = new UpdateArticleUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
    );

    const updated = await uc.execute(existing.id, baseInput({ coverUrl: COVER_B }));

    expect(repo.updateWithRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ coverUrl: COVER_B }),
      }),
    );
    expect(updated.coverUrl).toBe(COVER_B);
  });

  it('cover_url null: menghapus sampul', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const uc = new UpdateArticleUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
    );

    const updated = await uc.execute(existing.id, baseInput({ coverUrl: null }));

    expect(repo.updateWithRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ coverUrl: null }),
      }),
    );
    expect(updated.coverUrl).toBeNull();
  });

  it('tanpa perubahan termasuk cover: skip update', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const uc = new UpdateArticleUseCase(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit as any,
    );

    const result = await uc.execute(existing.id, baseInput());

    expect(repo.updateWithRevision).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
