import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  layananContributions,
  layanans,
  regions,
  users,
} from '@/shared/database/drizzle/schema';
import type {
  Layanan,
  LayananContribution,
  LayananFields,
} from '../domain/layanan';
import { parsePhonesJson, serializePhones } from '../domain/layanan';

const village = alias(regions, 'layanan_village');

type LayananRow = typeof layanans.$inferSelect;

function toLayanan(
  row: LayananRow,
  regionName: string | null,
  regionSlug: string | null,
  villageName: string | null,
): Layanan {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    name: row.name,
    phones: parsePhonesJson(row.phonesJson),
    logoUrl: row.logoUrl,
    addressText: row.addressText,
    lat: row.lat,
    lng: row.lng,
    mapsUrl: row.mapsUrl,
    regionId: row.regionId,
    regionName,
    regionSlug,
    villageId: row.villageId,
    villageName,
    note: row.note,
    publishStatus: row.publishStatus,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parsePayload(raw: string): LayananFields {
  return JSON.parse(raw) as LayananFields;
}

export class LayananRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  async listPublic(input: { regionRef?: string; category?: Layanan['category'] }): Promise<Layanan[]> {
    const conds = [eq(layanans.publishStatus, 'published')];
    if (input.category) conds.push(eq(layanans.category, input.category));
    if (input.regionRef) {
      conds.push(or(eq(regions.id, input.regionRef), eq(regions.slug, input.regionRef))!);
    }
    const rows = await this.db
      .select({
        layanan: layanans,
        regionName: regions.name,
        regionSlug: regions.slug,
        villageName: village.name,
      })
      .from(layanans)
      .innerJoin(regions, eq(layanans.regionId, regions.id))
      .leftJoin(village, eq(layanans.villageId, village.id))
      .where(and(...conds))
      .orderBy(asc(layanans.category), asc(layanans.name))
      .limit(200);
    return rows.map((r) => toLayanan(r.layanan, r.regionName, r.regionSlug, r.villageName));
  }

  async listManage(): Promise<Layanan[]> {
    const rows = await this.db
      .select({
        layanan: layanans,
        regionName: regions.name,
        regionSlug: regions.slug,
        villageName: village.name,
      })
      .from(layanans)
      .innerJoin(regions, eq(layanans.regionId, regions.id))
      .leftJoin(village, eq(layanans.villageId, village.id))
      .orderBy(desc(layanans.updatedAt), desc(layanans.createdAt))
      .limit(200);
    return rows.map((r) => toLayanan(r.layanan, r.regionName, r.regionSlug, r.villageName));
  }

  async findPublishedBySlug(slug: string): Promise<Layanan | null> {
    const [row] = await this.db
      .select({
        layanan: layanans,
        regionName: regions.name,
        regionSlug: regions.slug,
        villageName: village.name,
      })
      .from(layanans)
      .innerJoin(regions, eq(layanans.regionId, regions.id))
      .leftJoin(village, eq(layanans.villageId, village.id))
      .where(and(eq(layanans.slug, slug), eq(layanans.publishStatus, 'published')))
      .limit(1);
    return row ? toLayanan(row.layanan, row.regionName, row.regionSlug, row.villageName) : null;
  }

  async findById(id: string): Promise<Layanan | null> {
    const [row] = await this.db
      .select({
        layanan: layanans,
        regionName: regions.name,
        regionSlug: regions.slug,
        villageName: village.name,
      })
      .from(layanans)
      .innerJoin(regions, eq(layanans.regionId, regions.id))
      .leftJoin(village, eq(layanans.villageId, village.id))
      .where(eq(layanans.id, id))
      .limit(1);
    return row ? toLayanan(row.layanan, row.regionName, row.regionSlug, row.villageName) : null;
  }

  async existingSlugs(candidates: string[]): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: layanans.slug })
      .from(layanans)
      .where(inArray(layanans.slug, candidates));
    return new Set(rows.map((r) => r.slug));
  }

  async insert(input: LayananFields & { slug: string; authorId: string | null }): Promise<Layanan> {
    const now = new Date();
    const [row] = await this.db
      .insert(layanans)
      .values({
        slug: input.slug,
        category: input.category,
        name: input.name,
        phonesJson: serializePhones(input.phones),
        logoUrl: input.logoUrl,
        addressText: input.addressText,
        lat: input.lat,
        lng: input.lng,
        mapsUrl: input.mapsUrl,
        regionId: input.regionId,
        villageId: input.villageId,
        note: input.note,
        publishStatus: 'published',
        authorId: input.authorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const found = await this.findById(row!.id);
    return found!;
  }

  async update(id: string, patch: Partial<LayananFields> & { publishStatus?: Layanan['publishStatus'] }): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.phones !== undefined) set.phonesJson = serializePhones(patch.phones);
    if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl;
    if (patch.addressText !== undefined) set.addressText = patch.addressText;
    if (patch.lat !== undefined) set.lat = patch.lat;
    if (patch.lng !== undefined) set.lng = patch.lng;
    if (patch.mapsUrl !== undefined) set.mapsUrl = patch.mapsUrl;
    if (patch.regionId !== undefined) set.regionId = patch.regionId;
    if (patch.villageId !== undefined) set.villageId = patch.villageId;
    if (patch.note !== undefined) set.note = patch.note;
    if (patch.publishStatus !== undefined) set.publishStatus = patch.publishStatus;
    await this.db.update(layanans).set(set).where(eq(layanans.id, id));
  }

  async countOpenByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(layananContributions)
      .where(
        and(
          eq(layananContributions.userId, userId),
          inArray(layananContributions.status, ['pending', 'needs_revision']),
        ),
      );
    return Number(row?.n ?? 0);
  }

  async insertContribution(input: {
    kind: 'new' | 'edit';
    userId: string;
    layananId: string | null;
    payload: LayananFields;
  }): Promise<string> {
    const [row] = await this.db
      .insert(layananContributions)
      .values({
        kind: input.kind,
        userId: input.userId,
        layananId: input.layananId,
        payloadJson: JSON.stringify(input.payload),
        status: 'pending',
        createdAt: new Date(),
      })
      .returning({ id: layananContributions.id });
    return row!.id;
  }

  async findContribution(id: string): Promise<LayananContribution | null> {
    const [row] = await this.db
      .select({ row: layananContributions, username: users.username })
      .from(layananContributions)
      .leftJoin(users, eq(users.id, layananContributions.userId))
      .where(eq(layananContributions.id, id))
      .limit(1);
    return row ? this.toContribution(row.row, row.username) : null;
  }

  async listContributions(input: { status?: LayananContribution['status']; userId?: string }): Promise<LayananContribution[]> {
    const conds = [];
    if (input.status) conds.push(eq(layananContributions.status, input.status));
    if (input.userId) conds.push(eq(layananContributions.userId, input.userId));
    const rows = await this.db
      .select({ row: layananContributions, username: users.username })
      .from(layananContributions)
      .leftJoin(users, eq(users.id, layananContributions.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(layananContributions.createdAt))
      .limit(200);
    return rows.map((r) => this.toContribution(r.row, r.username));
  }

  async updateContribution(
    id: string,
    patch: Partial<{
      status: LayananContribution['status'];
      payload: LayananFields;
      resultLayananId: string | null;
      revisionNote: string | null;
      rejectReasonCode: string | null;
      rejectReasonText: string | null;
    }>,
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.payload !== undefined) set.payloadJson = JSON.stringify(patch.payload);
    if (patch.resultLayananId !== undefined) set.resultLayananId = patch.resultLayananId;
    if (patch.revisionNote !== undefined) set.revisionNote = patch.revisionNote;
    if (patch.rejectReasonCode !== undefined) set.rejectReasonCode = patch.rejectReasonCode;
    if (patch.rejectReasonText !== undefined) set.rejectReasonText = patch.rejectReasonText;
    await this.db.update(layananContributions).set(set).where(eq(layananContributions.id, id));
  }

  async deleteContribution(id: string): Promise<void> {
    await this.db.delete(layananContributions).where(eq(layananContributions.id, id));
  }

  private toContribution(
    row: typeof layananContributions.$inferSelect,
    username: string | null,
  ): LayananContribution {
    return {
      id: row.id,
      kind: row.kind,
      userId: row.userId,
      username,
      layananId: row.layananId,
      payload: parsePayload(row.payloadJson),
      status: row.status,
      resultLayananId: row.resultLayananId,
      revisionNote: row.revisionNote,
      rejectReasonCode: row.rejectReasonCode,
      rejectReasonText: row.rejectReasonText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
