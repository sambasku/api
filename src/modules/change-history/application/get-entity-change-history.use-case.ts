import { NotFoundError } from '@/shared/errors/app-error';
import {
  buildDisplayChanges,
  describeEntityAction,
  type DisplayChange,
  type ExploreEntityType,
} from '../domain/entity-change';
import type { ChangeHistoryRepository } from '../infrastructure/change-history.repository.impl';

export interface EntityChangeHistoryItem {
  id: string;
  timestamp: Date;
  actor: { userId: string | null; username: string | null; displayName: string | null };
  action: string;
  actionLabel: string;
  changes: DisplayChange[];
  /** Id usulan asal perubahan; null = perubahan langsung. */
  sourceContributionId: string | null;
}

const NOT_FOUND: Record<ExploreEntityType, [string, string]> = {
  place: ['PLACE_NOT_FOUND', 'Wisata tidak ditemukan'],
  cuisine: ['CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan'],
  usaha: ['USAHA_NOT_FOUND', 'Usaha tidak ditemukan'],
  event: ['EVENT_NOT_FOUND', 'Acara tidak ditemukan'],
  karya: ['KARYA_NOT_FOUND', 'Karya tidak ditemukan'],
  layanan: ['LAYANAN_NOT_FOUND', 'Layanan tidak ditemukan'],
  community: ['COMMUNITY_NOT_FOUND', 'Komunitas tidak ditemukan'],
};

export class GetEntityChangeHistoryUseCase {
  constructor(private readonly repo: ChangeHistoryRepository) {}

  async execute(input: {
    entityType: ExploreEntityType;
    slug: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: EntityChangeHistoryItem[]; nextCursor: string | null; hasMore: boolean }> {
    const entityId = await this.repo.resolvePublishedId(input.entityType, input.slug);
    if (!entityId) {
      const [code, message] = NOT_FOUND[input.entityType];
      throw new NotFoundError(code, message);
    }
    const page = await this.repo.listEntityHistory({
      entityType: input.entityType,
      entityId,
      limit: input.limit,
      cursor: input.cursor,
    });
    return {
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      items: page.items.map((r) => ({
        id: r.id,
        timestamp: r.createdAt,
        actor: {
          userId: r.actorUserId,
          username: r.actorUsername,
          displayName: r.actorDisplayName,
        },
        action: r.action,
        actionLabel: describeEntityAction(input.entityType, r.action, r.newData, r.oldData),
        // Baris 'create' cukup judul; daftar field penuh bikin timeline bising.
        changes:
          r.action === 'create' || r.action === 'takedown'
            ? []
            : buildDisplayChanges(input.entityType, r.oldData, r.newData),
        sourceContributionId: r.sourceContributionId,
      })),
    };
  }
}
