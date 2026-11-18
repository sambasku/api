import { and, eq, or } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { contentLinks } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  ContentLinkEndpoint,
  ContentLinkKind,
  ContentLinkRow,
} from '../domain/content-link';
import type { ContentLinkRepository } from '../domain/content-link.repository';

export class ContentLinkRepositoryImpl implements ContentLinkRepository {
  constructor(private readonly db: AppDatabase) {}

  async listForEndpoint(
    kind: ContentLinkKind,
    id: string,
  ): Promise<ContentLinkRow[]> {
    const rows = await this.db
      .select()
      .from(contentLinks)
      .where(
        or(
          and(eq(contentLinks.aKind, kind), eq(contentLinks.aId, id)),
          and(eq(contentLinks.bKind, kind), eq(contentLinks.bId, id)),
        ),
      );
    return rows.map(mapRow);
  }

  async replaceForAnchor(input: {
    anchor: ContentLinkEndpoint;
    pairs: Array<{ a: ContentLinkEndpoint; b: ContentLinkEndpoint }>;
    createdBy: string | null;
  }): Promise<void> {
    const { anchor, pairs, createdBy } = input;
    await this.db
      .delete(contentLinks)
      .where(
        or(
          and(
            eq(contentLinks.aKind, anchor.kind),
            eq(contentLinks.aId, anchor.id),
          ),
          and(
            eq(contentLinks.bKind, anchor.kind),
            eq(contentLinks.bId, anchor.id),
          ),
        ),
      );

    if (pairs.length === 0) return;

    const now = new Date();
    await this.db.insert(contentLinks).values(
      pairs.map((pair) => ({
        id: generateId(),
        aKind: pair.a.kind,
        aId: pair.a.id,
        bKind: pair.b.kind,
        bId: pair.b.id,
        createdBy,
        createdAt: now,
        updatedAt: null,
      })),
    );
  }
}

function mapRow(row: typeof contentLinks.$inferSelect): ContentLinkRow {
  return {
    id: row.id,
    aKind: row.aKind,
    aId: row.aId,
    bKind: row.bKind,
    bId: row.bId,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}
