import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { mobileReleases } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { MobileRelease, MobileReleasePlatform } from '../domain/entities/mobile-release.entity';
import type {
  MobileReleaseRepository,
  UpsertMobileReleaseInput,
} from '../domain/repositories/mobile-release.repository';

function toEntity(row: typeof mobileReleases.$inferSelect): MobileRelease {
  return {
    id: row.id,
    platform: row.platform as MobileReleasePlatform,
    version: row.version,
    storeUrl: row.storeUrl,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class MobileReleaseRepositoryImpl implements MobileReleaseRepository {
  constructor(private readonly db: AppDatabase) {}

  async findLatest(platform: MobileReleasePlatform): Promise<MobileRelease | null> {
    const [row] = await this.db
      .select()
      .from(mobileReleases)
      .where(eq(mobileReleases.platform, platform));
    return row ? toEntity(row) : null;
  }

  async list(): Promise<MobileRelease[]> {
    const rows = await this.db.select().from(mobileReleases);
    return rows.map(toEntity);
  }

  async upsert(input: UpsertMobileReleaseInput): Promise<MobileRelease> {
    const now = new Date();
    const existing = await this.findLatest(input.platform);

    if (existing) {
      const [row] = await this.db
        .update(mobileReleases)
        .set({
          version: input.version,
          storeUrl: input.storeUrl ?? existing.storeUrl,
          notes: input.notes ?? existing.notes,
          updatedAt: now,
        })
        .where(eq(mobileReleases.platform, input.platform))
        .returning();
      return toEntity(row);
    }

    const [row] = await this.db
      .insert(mobileReleases)
      .values({
        id: generateId(),
        platform: input.platform,
        version: input.version,
        storeUrl: input.storeUrl ?? null,
        notes: input.notes ?? null,
        createdAt: now,
      })
      .returning();
    return toEntity(row);
  }
}
