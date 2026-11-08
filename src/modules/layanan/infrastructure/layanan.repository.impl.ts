import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  layananContributions,
  layanans,
  regions,
  users,
} from '@/shared/database/drizzle/schema';
import type { LayananCategory } from '@/shared/database/drizzle/schema/layanans.schema';
import type {
  Layanan,
  LayananContribution,
  LayananFields,
} from '../domain/layanan';

const villageRegions = alias(regions, 'layanan_village');

/** ponytail: satu kecamatan tidak punya ratusan nomor darurat. Naikkan + keyset bila lewat. */
const LIST_CAP = 200;

type LayananRow = {
  id: string;
  slug: string;
  category: LayananCategory;
  name: string;
  phone: string;
  whatsapp: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  regionId: string;
  villageId: string | null;
  note: string | null;
  publishStatus: Layanan['publishStatus'];
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  regionName: string | null;
  regionSlug: string | null;
  villageName: string | null;
};

function toLayanan(row: LayananRow): Layanan {
  return row;
}

export class LayananRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  async listPublic(filter: {
    regionRef?: string;
    category?: LayananCategory;
  }): Promise<Layanan[]> {
    const conds = [
      eq(layanans.publishStatus, 'published'),
    ];
    if (filter.category) conds.push(eq(layanans.category, filter.category));
    if (filter.regionRef) {
      conds.push(
        or(eq(regions.id, filter.regionRef), eq(regions.slug, filter.regionRef))!,
      );
    }
    const rows = await this.db
      .select(this.layananSelect())
      .from(layanans)
      .innerJoin(regions, eq(regions.id, layanans.regionId))
      .leftJoin(villageRegions, eq(villageRegions.id, layanans.villageId))
      .where(and(...conds))
      .orderBy(asc(layanans.category), asc(layanans.name))
      .limit(LIST_CAP);
    return rows.map(toLayanan);
  }

  async listManage(regionRef?: string): Promise<Layanan[]> {
    const conds = [];
    if (regionRef) {
      conds.push(or(eq(regions.id, regionRef), eq(regions.slug, regionRef))!);
    }
    const rows = await this.db
      .select(this.layananSelect())
      .from(layanans)
      .innerJoin(regions, eq(regions.id, layanans.regionId))
      .leftJoin(villageRegions, eq(villageRegions.id, layanans.villageId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(layanans.publishStatus), asc(layanans.name))
      .limit(LIST_CAP);
    return rows.map(toLayanan);
  }

  async findPublishedBySlug(slug: string): Promise<Layanan | null> {
    const [row] = await this.db
      .select(this.layananSelect())
      .from(layanans)
      .innerJoin(regions, eq(regions.id, layanans.regionId))
      .leftJoin(villageRegions, eq(villageRegions.id, layanans.villageId))
      .where(and(eq(layanans.slug, slug), eq(layanans.publishStatus, 'published')))
      .limit(1);
    return row ? toLayanan(row) : null;
  }

  async findById(id: string): Promise<Layanan | null> {
    const [row] = await this.db
      .select(this.layananSelect())
      .from(layanans)
      .innerJoin(regions, eq(regions.id, layanans.regionId))
      .leftJoin(villageRegions, eq(villageRegions.id, layanans.villageId))
      .where(eq(layanans.id, id))
      .limit(1);
    return row ? toLayanan(row) : null;
  }

  async existingSlugs(candidates: string[]): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: layanans.slug })
      .from(layanans)
      .where(inArray(layanans.slug, candidates));
    return new Set(rows.map((r) => r.slug));
  }

  async insert(input: {
    slug: string;
    fields: LayananFields;
    authorId: string;
    publishStatus: Layanan['publishStatus'];
  }): Promise<string> {
    const now = new Date();
    const [row] = await this.db
      .insert(layanans)
      .values({
        slug: input.slug,
        ...this.fieldCols(input.fields),
        publishStatus: input.publishStatus,
        authorId: input.authorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: layanans.id });
    return row!.id;
  }

  async update(
    id: string,
    fields: Partial<LayananFields> & { publishStatus?: Layanan['publishStatus'] },
  ): Promise<void> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.phone !== undefined) patch.phone = fields.phone;
    if (fields.whatsapp !== undefined) patch.whatsapp = fields.whatsapp;
    if (fields.addressText !== undefined) patch.addressText = fields.addressText;
    if (fields.lat !== undefined) patch.lat = fields.lat;
    if (fields.lng !== undefined) patch.lng = fields.lng;
    if (fields.mapsUrl !== undefined) patch.mapsUrl = fields.mapsUrl;
    if (fields.regionId !== undefined) patch.regionId = fields.regionId;
    if (fields.villageId !== undefined) patch.villageId = fields.villageId;
    if (fields.note !== undefined) patch.note = fields.note;
    if (fields.publishStatus !== undefined) patch.publishStatus = fields.publishStatus;
    await this.db.update(layanans).set(patch).where(eq(layanans.id, id));
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
    kind: LayananContribution['kind'];
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
    const [row] = await this.contributionSelect()
      .where(eq(layananContributions.id, id))
      .limit(1);
    return row ? this.toContribution(row) : null;
  }

  async listContributions(filter: {
    status?: LayananContribution['status'];
    userId?: string;
  }): Promise<LayananContribution[]> {
    const conds = [];
    if (filter.status) conds.push(eq(layananContributions.status, filter.status));
    if (filter.userId) conds.push(eq(layananContributions.userId, filter.userId));
    const rows = await this.contributionSelect()
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(sql`${layananContributions.createdAt} desc`)
      .limit(100);
    return rows.map((r) => this.toContribution(r));
  }

  async updateContribution(
    id: string,
    patch: {
      status?: LayananContribution['status'];
      payload?: LayananFields;
      resultLayananId?: string | null;
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewed?: boolean;
    },
  ): Promise<void> {
    const now = new Date();
    const set: {
      updatedAt: Date;
      status?: LayananContribution['status'];
      payloadJson?: string;
      resultLayananId?: string | null;
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewedAt?: Date;
    } = { updatedAt: now };
    if (patch.status) set.status = patch.status;
    if (patch.payload) set.payloadJson = JSON.stringify(patch.payload);
    if (patch.resultLayananId !== undefined) set.resultLayananId = patch.resultLayananId;
    if (patch.revisionNote !== undefined) set.revisionNote = patch.revisionNote;
    if (patch.rejectReasonCode !== undefined) set.rejectReasonCode = patch.rejectReasonCode;
    if (patch.rejectReasonText !== undefined) set.rejectReasonText = patch.rejectReasonText;
    if (patch.reviewed) set.reviewedAt = now;
    await this.db.update(layananContributions).set(set).where(eq(layananContributions.id, id));
  }

  async deleteContribution(id: string): Promise<void> {
    await this.db.delete(layananContributions).where(eq(layananContributions.id, id));
  }

  private layananSelect() {
    return {
      id: layanans.id,
      slug: layanans.slug,
      category: layanans.category,
      name: layanans.name,
      phone: layanans.phone,
      whatsapp: layanans.whatsapp,
      addressText: layanans.addressText,
      lat: layanans.lat,
      lng: layanans.lng,
      mapsUrl: layanans.mapsUrl,
      regionId: layanans.regionId,
      villageId: layanans.villageId,
      note: layanans.note,
      publishStatus: layanans.publishStatus,
      authorId: layanans.authorId,
      createdAt: layanans.createdAt,
      updatedAt: layanans.updatedAt,
      regionName: regions.name,
      regionSlug: regions.slug,
      villageName: villageRegions.name,
    };
  }

  private fieldCols(fields: LayananFields) {
    return {
      category: fields.category,
      name: fields.name,
      phone: fields.phone,
      whatsapp: fields.whatsapp,
      addressText: fields.addressText,
      lat: fields.lat,
      lng: fields.lng,
      mapsUrl: fields.mapsUrl,
      regionId: fields.regionId,
      villageId: fields.villageId,
      note: fields.note,
    };
  }

  private contributionSelect() {
    return this.db
      .select({
        id: layananContributions.id,
        kind: layananContributions.kind,
        userId: layananContributions.userId,
        username: users.username,
        layananId: layananContributions.layananId,
        payloadJson: layananContributions.payloadJson,
        status: layananContributions.status,
        resultLayananId: layananContributions.resultLayananId,
        revisionNote: layananContributions.revisionNote,
        rejectReasonCode: layananContributions.rejectReasonCode,
        rejectReasonText: layananContributions.rejectReasonText,
        createdAt: layananContributions.createdAt,
        updatedAt: layananContributions.updatedAt,
        reviewedAt: layananContributions.reviewedAt,
      })
      .from(layananContributions)
      .leftJoin(users, and(eq(users.id, layananContributions.userId), isNull(users.deletedAt)));
  }

  private toContribution(row: {
    id: string;
    kind: LayananContribution['kind'];
    userId: string;
    username: string | null;
    layananId: string | null;
    payloadJson: string;
    status: LayananContribution['status'];
    resultLayananId: string | null;
    revisionNote: string | null;
    rejectReasonCode: string | null;
    rejectReasonText: string | null;
    createdAt: Date;
    updatedAt: Date | null;
    reviewedAt: Date | null;
  }): LayananContribution {
    return {
      id: row.id,
      kind: row.kind,
      userId: row.userId,
      username: row.username,
      layananId: row.layananId,
      payload: JSON.parse(row.payloadJson) as LayananFields,
      status: row.status,
      resultLayananId: row.resultLayananId,
      revisionNote: row.revisionNote,
      rejectReasonCode: row.rejectReasonCode,
      rejectReasonText: row.rejectReasonText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reviewedAt: row.reviewedAt,
    };
  }
}
