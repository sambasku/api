import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

/** Kronologis naik: balasan dibaca atas ke bawah dalam thread. */
function compareCommentChronological(a: JinyeComment, b: JinyeComment): number {
  const timeCmp = a.createdAt.getTime() - b.createdAt.getTime();
  if (timeCmp !== 0) return timeCmp;
  return a.id.localeCompare(b.id);
}

/** Feed utama: terbaru di atas (selaras komentar kata/entitas). */
function compareCommentNewestFirst(a: JinyeComment, b: JinyeComment): number {
  return -compareCommentChronological(a, b);
}

/**
 * List komen published + nest reply 1 level di bawah parent.
 * Satu query flat, compose di memori (hindari N+1).
 */
export class ListJinyeCommentsUseCase {
  constructor(private readonly repo: JinyeRepository) {}

  async execute(jinyeId: string): Promise<JinyeComment[]> {
    const jinye = await this.repo.findById(jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const flat = await this.repo.listCommentsByJinyeId(jinyeId);
    const tops: JinyeComment[] = [];
    const byId = new Map<string, JinyeComment>();

    for (const c of flat) {
      if (!c.parentId) {
        const node = { ...c, replies: [] as JinyeComment[] };
        byId.set(c.id, node);
        tops.push(node);
      }
    }
    for (const c of flat) {
      if (!c.parentId) continue;
      const parent = byId.get(c.parentId);
      if (parent) {
        parent.replies = parent.replies ?? [];
        parent.replies.push(c);
      }
      // Orphan reply (parent deleted) - skip; tidak diangkat ke top.
    }
    for (const top of tops) {
      top.replies?.sort(compareCommentChronological);
    }
    tops.sort(compareCommentNewestFirst);
    return tops;
  }
}
