import { NotFoundError } from '@/shared/errors/app-error';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  ListPlaceVisitsResult,
  PlaceVisitMarkResult,
  PlaceVisitRepository,
} from '../../domain/repositories/place-visit.repository';

export class MarkPlaceVisitUseCase {
  constructor(
    private readonly repo: PlaceVisitRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, placeId: string): Promise<PlaceVisitMarkResult> {
    const place = await this.repo.findPublishedPlace(placeId);
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }

    const before = await this.repo.viewerVisitedByPlaceIds(userId, [placeId]);
    const wasVisited = before.has(placeId);
    const result = await this.repo.mark(userId, placeId);

    if (!wasVisited && result.viewerVisited) {
      await this.activityEvents?.safe({
        kind: 'place_visited',
        actorId: userId,
        targetId: placeId,
        dedupeKey: `place.visit:${userId}:${placeId}`,
        payload: `Pernah singgah di "${place.name}"`,
      });
    }

    return result;
  }
}

export class UnmarkPlaceVisitUseCase {
  constructor(
    private readonly repo: PlaceVisitRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, placeId: string): Promise<PlaceVisitMarkResult> {
    const place = await this.repo.findPublishedPlace(placeId);
    if (!place) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }

    const before = await this.repo.viewerVisitedByPlaceIds(userId, [placeId]);
    const wasVisited = before.has(placeId);
    const result = await this.repo.unmark(userId, placeId);

    if (wasVisited) {
      await this.activityEvents?.safe({
        kind: 'place_visited',
        actorId: userId,
        targetId: placeId,
        dedupeKey: `place.visit:${userId}:${placeId}`,
        payload: `Pernah singgah di "${place.name}"`,
        hidden: true,
      });
    }

    return result;
  }
}

export class ListPlaceVisitsUseCase {
  constructor(private readonly repo: PlaceVisitRepository) {}

  async execute(
    placeId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListPlaceVisitsResult> {
    const result = await this.repo.listByPlaceId(placeId, opts);
    if (!result) {
      throw new NotFoundError('PLACE_NOT_FOUND', 'Place tidak ditemukan');
    }
    return result;
  }
}