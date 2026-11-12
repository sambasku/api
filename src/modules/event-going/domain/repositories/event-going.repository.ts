export interface EventGoingMarkResult {
  goingCount: number;
  viewerGoing: boolean;
}

export interface EventGoingUser {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface ListEventGoingsResult {
  items: EventGoingUser[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

/** Event yang boleh di-mark: published, belum cancelled. */
export interface EventGoingTarget {
  id: string;
  name: string;
  slug: string;
  status: string;
  cancelledAt: Date | null;
  startsAt: Date;
  endsAt: Date;
}

export interface EventGoingRepository {
  findPublishedEvent(eventId: string): Promise<EventGoingTarget | null>;

  /** Idempotent mark: insert if missing. */
  mark(userId: string, eventId: string): Promise<EventGoingMarkResult>;

  /** Idempotent unmark: hard delete if present. */
  unmark(userId: string, eventId: string): Promise<EventGoingMarkResult>;

  countByEventIds(eventIds: string[]): Promise<Map<string, number>>;

  viewerGoingByEventIds(
    userId: string,
    eventIds: string[],
  ): Promise<Set<string>>;

  listByEventId(
    eventId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListEventGoingsResult | null>;
}
