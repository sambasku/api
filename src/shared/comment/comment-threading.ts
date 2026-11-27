import { NotFoundError, ValidationError } from '@/shared/errors/app-error';

export interface CommentParentCandidate {
  id: string;
  hostId: string;
  parentId: string | null;
  status: string;
}

/**
 * Validasi `parent_id` untuk threading 2-level seragam:
 * - parent harus ada, milik host yang sama, dan berstatus `published`
 * - parent harus komentar top-level (`parentId === null`) - max 1 tingkat balasan
 */
export async function resolveCommentParentId(input: {
  rawParentId?: string | null;
  hostId: string;
  findParent: (id: string) => Promise<CommentParentCandidate | null>;
}): Promise<string | null> {
  const trimmed = input.rawParentId?.trim() ?? '';
  if (!trimmed) return null;

  const parent = await input.findParent(trimmed);
  if (!parent || parent.hostId !== input.hostId || parent.status !== 'published') {
    throw new NotFoundError(
      'COMMENT_PARENT_NOT_FOUND',
      'Komentar yang dibalas tidak ditemukan',
    );
  }
  if (parent.parentId !== null) {
    throw new ValidationError([
      {
        field: 'parent_id',
        message: 'Balasan komentar hanya mendukung satu tingkat',
      },
    ]);
  }
  return parent.id;
}

/** Kronologis naik: balasan dibaca dari atas ke bawah dalam satu thread. */
export function compareCommentChronological<
  T extends { id: string; createdAt: Date },
>(a: T, b: T): number {
  const timeCmp = a.createdAt.getTime() - b.createdAt.getTime();
  if (timeCmp !== 0) return timeCmp;
  return a.id.localeCompare(b.id);
}

/** Feed utama: terbaru di atas. */
export function compareCommentNewestFirst<
  T extends { id: string; createdAt: Date },
>(a: T, b: T): number {
  return -compareCommentChronological(a, b);
}

/**
 * Pasangkan batch balasan (`WHERE parent_id IN (...)`) ke daftar komentar top-level.
 * Menjaga urutan `tops` (hasil paginasi) dan mengurutkan balasan kronologis naik.
 */
export function attachCommentRepliesTwoLevel<
  T extends { id: string; parentId?: string | null; createdAt: Date },
>(tops: T[], replies: T[]): Array<T & { replies: T[] }> {
  const byParent = new Map<string, T[]>();
  for (const r of replies) {
    const pid = r.parentId;
    if (!pid) continue;
    const bucket = byParent.get(pid);
    if (bucket) {
      bucket.push(r);
    } else {
      byParent.set(pid, [r]);
    }
  }
  return tops.map((top) => {
    const children = byParent.get(top.id) ?? [];
    children.sort(compareCommentChronological);
    return { ...top, replies: children };
  });
}

/**
 * Susun hasil query flat menjadi tree 2-level di memori (tanpa N+1).
 * Top-level urut terbaru di atas; balasan urut kronologis naik; orphan di-skip.
 */
export function nestFlatCommentsTwoLevel<
  T extends { id: string; parentId?: string | null; createdAt: Date },
>(flat: T[]): Array<T & { replies: T[] }> {
  const tops: Array<T & { replies: T[] }> = [];
  const byId = new Map<string, T & { replies: T[] }>();

  for (const item of flat) {
    if (!item.parentId) {
      const node: T & { replies: T[] } = { ...item, replies: [] };
      byId.set(item.id, node);
      tops.push(node);
    }
  }
  for (const item of flat) {
    if (!item.parentId) continue;
    const parent = byId.get(item.parentId);
    if (parent) {
      parent.replies.push(item);
    }
  }
  for (const top of tops) {
    top.replies.sort(compareCommentChronological);
  }
  tops.sort(compareCommentNewestFirst);
  return tops;
}

export interface CommentEditRevisionRow {
  editorId: string;
  body: string;
  createdAt: Date;
}

/** Format seragam respons GET .../comments/:id/edit-history di semua target. */
export function buildCommentEditHistoryWire(
  comment: { status: string; body: string; updatedAt: Date | null },
  revisions: CommentEditRevisionRow[],
) {
  const isPublished = comment.status === 'published';
  return {
    current: {
      body: isPublished ? comment.body : null,
      updated_at: comment.updatedAt?.toISOString() ?? null,
      is_edited: revisions.length > 0,
    },
    revisions: isPublished
      ? revisions.map((r) => ({
          body: r.body,
          editor_id: r.editorId,
          created_at: r.createdAt.toISOString(),
        }))
      : [],
  };
}
