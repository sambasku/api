import { NotFoundError } from '@/shared/errors/app-error';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  ListUsahaVisitsResult,
  UsahaVisitMarkResult,
  UsahaVisitRepository,
} from '../../domain/repositories/usaha-visit.repository';

export class MarkUsahaVisitUseCase {
  constructor(
    private readonly repo: UsahaVisitRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, usahaId: string): Promise<UsahaVisitMarkResult> {
    const usaha = await this.repo.findPublishedUsaha(usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }

    const before = await this.repo.viewerVisitedByUsahaIds(userId, [usahaId]);
    const wasVisited = before.has(usahaId);
    const result = await this.repo.mark(userId, usahaId);

    if (!wasVisited && result.viewerVisited) {
      await this.activityEvents?.safe({
        kind: 'usaha_visited',
        actorId: userId,
        targetId: usahaId,
        dedupeKey: `usaha.visit:${userId}:${usahaId}`,
        payload: `Pernah bertransaksi di "${usaha.name}"`,
      });
    }

    return result;
  }
}

export class UnmarkUsahaVisitUseCase {
  constructor(
    private readonly repo: UsahaVisitRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, usahaId: string): Promise<UsahaVisitMarkResult> {
    const usaha = await this.repo.findPublishedUsaha(usahaId);
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }

    const before = await this.repo.viewerVisitedByUsahaIds(userId, [usahaId]);
    const wasVisited = before.has(usahaId);
    const result = await this.repo.unmark(userId, usahaId);

    if (wasVisited) {
      await this.activityEvents?.safe({
        kind: 'usaha_visited',
        actorId: userId,
        targetId: usahaId,
        dedupeKey: `usaha.visit:${userId}:${usahaId}`,
        payload: `Pernah bertransaksi di "${usaha.name}"`,
        hidden: true,
      });
    }

    return result;
  }
}

export class ListUsahaVisitsUseCase {
  constructor(private readonly repo: UsahaVisitRepository) {}

  async execute(
    usahaId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListUsahaVisitsResult> {
    const result = await this.repo.listByUsahaId(usahaId, opts);
    if (!result) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    return result;
  }
}