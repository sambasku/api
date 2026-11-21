export interface UsahaVisitMarkResult {
  visitCount: number;
  viewerVisited: boolean;
}

export interface UsahaVisitUser {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface ListUsahaVisitsResult {
  items: UsahaVisitUser[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

/** Usaha yang boleh di-mark: publish_status published, tidak soft-delete. */
export interface UsahaVisitTarget {
  id: string;
  name: string;
  slug: string;
  publishStatus: string;
}

export interface UsahaVisitRepository {
  findPublishedUsaha(usahaId: string): Promise<UsahaVisitTarget | null>;

  mark(userId: string, usahaId: string): Promise<UsahaVisitMarkResult>;

  unmark(userId: string, usahaId: string): Promise<UsahaVisitMarkResult>;

  countByUsahaIds(usahaIds: string[]): Promise<Map<string, number>>;

  viewerVisitedByUsahaIds(
    userId: string,
    usahaIds: string[],
  ): Promise<Set<string>>;

  listByUsahaId(
    usahaId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<ListUsahaVisitsResult | null>;
}