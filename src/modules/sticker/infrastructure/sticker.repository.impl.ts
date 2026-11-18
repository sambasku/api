import { and, asc, eq, isNull } from 'drizzle-orm';
import { stickers } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { Sticker } from '../domain/entities/sticker.entity';
import type {
  CreateStickerInput,
  StickerRepository,
  UpdateStickerInput,
} from '../domain/repositories/sticker.repository';

function mapRow(r: typeof stickers.$inferSelect): Sticker {
  return {
    id: r.id,
    imageUrl: r.imageUrl,
    playOnce: Boolean(r.playOnce),
    sortOrder: r.sortOrder,
    isActive: Boolean(r.isActive),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? null,
    deletedAt: r.deletedAt ?? null,
  };
}

export class StickerRepositoryImpl implements StickerRepository {
  constructor(private readonly db: AppDatabase) {}

  async listActive(): Promise<Sticker[]> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(and(isNull(stickers.deletedAt), eq(stickers.isActive, true)))
      .orderBy(asc(stickers.sortOrder), asc(stickers.id));
    return rows.map(mapRow);
  }

  async listAll(): Promise<Sticker[]> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(isNull(stickers.deletedAt))
      .orderBy(asc(stickers.sortOrder), asc(stickers.id));
    return rows.map(mapRow);
  }

  async findActiveById(id: string): Promise<Sticker | null> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(
        and(
          eq(stickers.id, id),
          isNull(stickers.deletedAt),
          eq(stickers.isActive, true),
        ),
      )
      .limit(1);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async findById(id: string): Promise<Sticker | null> {
    const rows = await this.db
      .select()
      .from(stickers)
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .limit(1);
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async create(input: CreateStickerInput): Promise<Sticker> {
    const rows = await this.db
      .insert(stickers)
      .values({
        id: input.id,
        imageUrl: input.imageUrl,
        playOnce: input.playOnce ?? false,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      })
      .returning();
    return mapRow(rows[0]!);
  }

  async update(id: string, input: UpdateStickerInput): Promise<Sticker | null> {
    const values: Partial<typeof stickers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.imageUrl !== undefined) values.imageUrl = input.imageUrl;
    if (input.playOnce !== undefined) values.playOnce = input.playOnce;
    if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) values.isActive = input.isActive;
    const rows = await this.db
      .update(stickers)
      .set(values)
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning();
    const r = rows[0];
    return r ? mapRow(r) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .update(stickers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
      .where(and(eq(stickers.id, id), isNull(stickers.deletedAt)))
      .returning({ id: stickers.id });
    return rows.length > 0;
  }
}
