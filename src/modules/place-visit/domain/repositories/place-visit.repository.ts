export interface PlaceVisitMarkResult {
  visitCount: number;
  viewerVisited: boolean;
}

export interface PlaceVisitUser {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface ListPlaceVisitsResult {
  items: PlaceVisitUser[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

/** Wisata yang boleh di-mark: published, tidak soft-delete. */
export interface PlaceVisitTarget {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface PlaceVisitRepository {
  findPublishedPlace(placeId: string): Promise<PlaceVisitTarget | null>;

  /** Idempotent mark: insert if missing. */
  mark(userId: string, placeId: string): Promise<PlaceVisitMarkResult>;

  /** Idempotent unmark: hard delete if present. */
  unmark(userId: string, placeId: string): Promise<PlaceVisitMarkResult>;

  countByPlaceIds(placeIds: string[]): Promise<Map<string, number>>;

  viewerVisitedByPlaceIds(
    userId: string,
    placeIds: string[],
  ): Promise<Set<string>>;

  listByPlaceId(
    placeId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListPlaceVisitsResult | null>;
}