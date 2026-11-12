import { describe, it, expect, vi } from 'vitest';
import {
  MarkEventGoingUseCase,
  UnmarkEventGoingUseCase,
} from '../../application/use-cases/event-going.use-cases';
import type { EventGoingRepository } from '../../domain/repositories/event-going.repository';

function repoMock(over: Partial<EventGoingRepository> = {}): EventGoingRepository {
  return {
    findPublishedEvent: vi.fn().mockResolvedValue({
      id: '01EVENTGOINGTEST000000001',
      name: 'Pawai Test',
      slug: 'pawai-test',
      status: 'published',
      cancelledAt: null,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 90_000_000),
    }),
    mark: vi.fn().mockResolvedValue({ goingCount: 1, viewerGoing: true }),
    unmark: vi.fn().mockResolvedValue({ goingCount: 0, viewerGoing: false }),
    countByEventIds: vi.fn().mockResolvedValue(new Map()),
    viewerGoingByEventIds: vi.fn().mockResolvedValue(new Set()),
    listByEventId: vi.fn(),
    ...over,
  };
}

describe('MarkEventGoingUseCase', () => {
  it('menolak acara completed', async () => {
    const repo = repoMock({
      findPublishedEvent: vi.fn().mockResolvedValue({
        id: '01EVENTGOINGTEST000000001',
        name: 'Pawai Test',
        slug: 'pawai-test',
        status: 'published',
        cancelledAt: null,
        startsAt: new Date(Date.now() - 90_000_000),
        endsAt: new Date(Date.now() - 86_400_000),
      }),
    });
    await expect(
      new MarkEventGoingUseCase(repo).execute('user1', '01EVENTGOINGTEST000000001'),
    ).rejects.toMatchObject({ errorCode: 'EVENT_COMPLETED' });
  });

  it('menulis activity saat mark pertama kali', async () => {
    const repo = repoMock({
      viewerGoingByEventIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new MarkEventGoingUseCase(repo, activity as never).execute(
      'user1',
      '01EVENTGOINGTEST000000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'event_going',
        dedupeKey: 'event.going:user1:01EVENTGOINGTEST000000001',
        actorId: 'user1',
      }),
    );
  });
});

describe('UnmarkEventGoingUseCase', () => {
  it('menyembunyikan activity hanya jika sebelumnya going', async () => {
    const repo = repoMock({
      viewerGoingByEventIds: vi
        .fn()
        .mockResolvedValue(new Set(['01EVENTGOINGTEST000000001'])),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkEventGoingUseCase(repo, activity as never).execute(
      'user1',
      '01EVENTGOINGTEST000000001',
    );
    expect(activity.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'event_going',
        hidden: true,
      }),
    );
  });

  it('tidak menulis activity jika belum going', async () => {
    const repo = repoMock({
      viewerGoingByEventIds: vi.fn().mockResolvedValue(new Set()),
    });
    const activity = { safe: vi.fn().mockResolvedValue(undefined) };
    await new UnmarkEventGoingUseCase(repo, activity as never).execute(
      'user1',
      '01EVENTGOINGTEST000000001',
    );
    expect(activity.safe).not.toHaveBeenCalled();
  });
});
