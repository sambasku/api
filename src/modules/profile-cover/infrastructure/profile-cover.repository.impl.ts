import { and, desc, eq } from 'drizzle-orm';
import { profileCovers } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ActiveProfileCovers,
  ProfileCover,
  ProfileCoverVariant,
} from '../domain/entities/profile-cover.entity';
import type {
  CreateProfileCoverInput,
  ProfileCoverRepository,
} from '../domain/repositories/profile-cover.repository';

function mapRow(r: typeof profileCovers.$inferSelect): ProfileCover {
  return {
    id: r.id,
    variant: r.variant as ProfileCoverVariant,
    url: r.url,
    fileId: r.fileId ?? null,
    width: r.width,
    height: r.height,
    sizeBytes: r.sizeBytes ?? null,
    isActive: Boolean(r.isActive),
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt,
    activatedAt: r.activatedAt ?? null,
  };
}

export class ProfileCoverRepositoryImpl implements ProfileCoverRepository {
  constructor(private readonly db: AppDatabase) {}

  async listByVariant(variant: ProfileCoverVariant): Promise<ProfileCover[]> {
    const rows = await this.db
      .select()
      .from(profileCovers)
      .where(eq(profileCovers.variant, variant))
      .orderBy(desc(profileCovers.createdAt), desc(profileCovers.id));
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<ProfileCover | null> {
    const [row] = await this.db
      .select()
      .from(profileCovers)
      .where(eq(profileCovers.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async getActiveUrls(): Promise<ActiveProfileCovers> {
    const rows = await this.db
      .select({
        variant: profileCovers.variant,
        url: profileCovers.url,
      })
      .from(profileCovers)
      .where(eq(profileCovers.isActive, true));
    let tabUrl: string | null = null;
    let publicUrl: string | null = null;
    for (const row of rows) {
      if (row.variant === 'tab') tabUrl = row.url;
      if (row.variant === 'public') publicUrl = row.url;
    }
    return { tabUrl, publicUrl };
  }

  async create(input: CreateProfileCoverInput): Promise<ProfileCover> {
    const now = new Date();
    if (input.isActive) {
      return this.db.transaction(async (tx) => {
        await tx
          .update(profileCovers)
          .set({ isActive: false, activatedAt: null })
          .where(
            and(
              eq(profileCovers.variant, input.variant),
              eq(profileCovers.isActive, true),
            ),
          );
        await tx.insert(profileCovers).values({
          id: input.id,
          variant: input.variant,
          url: input.url,
          fileId: input.fileId ?? null,
          width: input.width,
          height: input.height,
          sizeBytes: input.sizeBytes ?? null,
          isActive: true,
          createdBy: input.createdBy,
          createdAt: now,
          activatedAt: input.activatedAt ?? now,
        });
        const [row] = await tx
          .select()
          .from(profileCovers)
          .where(eq(profileCovers.id, input.id))
          .limit(1);
        if (!row) throw new Error('Profile cover insert gagal');
        return mapRow(row);
      });
    }

    await this.db.insert(profileCovers).values({
      id: input.id,
      variant: input.variant,
      url: input.url,
      fileId: input.fileId ?? null,
      width: input.width,
      height: input.height,
      sizeBytes: input.sizeBytes ?? null,
      isActive: false,
      createdBy: input.createdBy,
      createdAt: now,
      activatedAt: null,
    });
    const created = await this.findById(input.id);
    if (!created) throw new Error('Profile cover insert gagal');
    return created;
  }

  async activate(id: string): Promise<ProfileCover> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('PROFILE_COVER_NOT_FOUND');
    }
    if (existing.isActive) return existing;

    return this.db.transaction(async (tx) => {
      await tx
        .update(profileCovers)
        .set({ isActive: false, activatedAt: null })
        .where(
          and(
            eq(profileCovers.variant, existing.variant),
            eq(profileCovers.isActive, true),
          ),
        );
      const activatedAt = new Date();
      await tx
        .update(profileCovers)
        .set({ isActive: true, activatedAt })
        .where(eq(profileCovers.id, id));
      const [row] = await tx
        .select()
        .from(profileCovers)
        .where(eq(profileCovers.id, id))
        .limit(1);
      if (!row) throw new Error('PROFILE_COVER_NOT_FOUND');
      return mapRow(row);
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(profileCovers).where(eq(profileCovers.id, id));
  }
}