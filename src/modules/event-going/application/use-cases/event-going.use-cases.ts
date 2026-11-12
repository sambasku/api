import {
  BadRequestError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { occurrenceStatus } from '@/modules/event/domain/entities/event.entity';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  EventGoingMarkResult,
  EventGoingRepository,
  ListEventGoingsResult,
} from '../../domain/repositories/event-going.repository';

function assertMarkable(
  event: {
    cancelledAt: Date | null;
    startsAt: Date;
    endsAt: Date;
  },
): void {
  const status = occurrenceStatus(event);
  if (status === 'cancelled') {
    throw new BadRequestError(
      'EVENT_CANCELLED',
      'Acara ini sudah dibatalkan. Rencana datang tidak bisa diubah.',
    );
  }
  if (status === 'completed') {
    throw new BadRequestError(
      'EVENT_COMPLETED',
      'Acara ini sudah selesai. Rencana datang tidak bisa diubah.',
    );
  }
}

export class MarkEventGoingUseCase {
  constructor(
    private readonly repo: EventGoingRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, eventId: string): Promise<EventGoingMarkResult> {
    const event = await this.repo.findPublishedEvent(eventId);
    if (!event) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Acara tidak ditemukan');
    }
    assertMarkable(event);

    const before = await this.repo.viewerGoingByEventIds(userId, [eventId]);
    const wasGoing = before.has(eventId);
    const result = await this.repo.mark(userId, eventId);

    if (!wasGoing && result.viewerGoing) {
      await this.activityEvents?.safe({
        kind: 'event_going',
        actorId: userId,
        targetId: eventId,
        dedupeKey: `event.going:${userId}:${eventId}`,
        payload: `Berencana datang ke "${event.name}"`,
      });
    }

    return result;
  }
}

export class UnmarkEventGoingUseCase {
  constructor(
    private readonly repo: EventGoingRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(userId: string, eventId: string): Promise<EventGoingMarkResult> {
    const event = await this.repo.findPublishedEvent(eventId);
    if (!event) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Acara tidak ditemukan');
    }
    assertMarkable(event);

    const before = await this.repo.viewerGoingByEventIds(userId, [eventId]);
    const wasGoing = before.has(eventId);
    const result = await this.repo.unmark(userId, eventId);

    if (wasGoing) {
      await this.activityEvents?.safe({
        kind: 'event_going',
        actorId: userId,
        targetId: eventId,
        dedupeKey: `event.going:${userId}:${eventId}`,
        payload: `Berencana datang ke "${event.name}"`,
        hidden: true,
      });
    }

    return result;
  }
}

export class ListEventGoingsUseCase {
  constructor(private readonly repo: EventGoingRepository) {}

  async execute(
    eventId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListEventGoingsResult> {
    const result = await this.repo.listByEventId(eventId, opts);
    if (!result) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Acara tidak ditemukan');
    }
    return result;
  }
}
