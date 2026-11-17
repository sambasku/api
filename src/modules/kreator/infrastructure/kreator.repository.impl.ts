import { and, asc, desc, eq, inArray, isNull, like, ne, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  karyaCredits,
  karyas,
  kreatorClaims,
  kreators,
  type KreatorKind,
} from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import type { KaryaCredit } from '@/modules/karya/domain/karya';
import type {
  KaryaSummaryForKreator,
  Kreator,
  KreatorClaim,
  KreatorClaimWithMeta,
  KreatorLink,
} from '../domain/kreator';
import { parseKreatorLinksJson, slugifyKreator } from '../domain/kreator';

type KreatorRow = typeof kreators.$inferSelect;

function toKreator(row: KreatorRow): Kreator {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    kind: row.kind,
    bio: row.bio,
    originRegion: row.originRegion,
    links: parseKreatorLinksJson(row.linksJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapClaim(row: typeof kreatorClaims.$inferSelect): KreatorClaim {
  return {
    id: row.id,
    kreatorId: row.kreatorId,
    userId: row.userId,
    status: row.status,
    proofNote: row.proofNote,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class KreatorRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  async findKreatorBySlug(slug: string): Promise<Kreator | null> {
    const [row] = await this.db
      .select()
      .from(kreators)
      .where(and(eq(kreators.slug, slug), isNull(kreators.deletedAt)))
      .limit(1);
    return row ? toKreator(row) : null;
  }

  async findKreatorById(id: string): Promise<Kreator | null> {
    const [row] = await this.db
      .select()
      .from(kreators)
      .where(and(eq(kreators.id, id), isNull(kreators.deletedAt)))
      .limit(1);
    return row ? toKreator(row) : null;
  }

  async listKreators(input: { q?: string }): Promise<Kreator[]> {
    const conds = [isNull(kreators.deletedAt)];
    if (input.q?.trim()) {
      const term = `%${input.q.trim()}%`;
      conds.push(or(like(kreators.displayName, term), like(kreators.slug, term))!);
    }
    const rows = await this.db
      .select()
      .from(kreators)
      .where(and(...conds))
      .orderBy(asc(kreators.displayName))
      .limit(50);
    return rows.map(toKreator);
  }

  async slugsByIds(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .select({ id: kreators.id, slug: kreators.slug })
      .from(kreators)
      .where(inArray(kreators.id, ids));
    for (const r of rows) map.set(r.id, r.slug);
    return map;
  }

  async findOrCreateKreator(displayName: string, kind: KreatorKind = 'person'): Promise<Kreator> {
    const name = displayName.trim();
    if (!name) {
      throw new Error('Nama kreator kosong');
    }
    const lower = name.toLowerCase();
    const [byName] = await this.db
      .select()
      .from(kreators)
      .where(
        and(
          sql`lower(${kreators.displayName}) = ${lower}`,
          isNull(kreators.deletedAt),
        ),
      )
      .limit(1);
    if (byName) return toKreator(byName);

    const baseSlug = slugifyKreator(name);
    const [bySlug] = await this.db
      .select()
      .from(kreators)
      .where(and(eq(kreators.slug, baseSlug), isNull(kreators.deletedAt)))
      .limit(1);
    if (bySlug) return toKreator(bySlug);

    const slug = await this.uniqueSlug(baseSlug);
    const now = new Date();
    const id = generateId();
    await this.db.insert(kreators).values({
      id,
      slug,
      displayName: name,
      kind,
      linksJson: '[]',
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.findKreatorById(id);
    if (!created) throw new Error('Gagal membuat kreator');
    return created;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const rows = await this.db
      .select({ slug: kreators.slug })
      .from(kreators)
      .where(inArray(kreators.slug, candidates));
    const taken = new Set(rows.map((r) => r.slug));
    const free = candidates.find((c) => !taken.has(c));
    return free ?? `${base}-${Date.now()}`;
  }

  async listPublishedKaryaByKreatorId(kreatorId: string): Promise<KaryaSummaryForKreator[]> {
    const rows = await this.db
      .select({
        id: karyas.id,
        slug: karyas.slug,
        title: karyas.title,
        kind: karyas.kind,
        year: karyas.year,
        role: karyaCredits.role,
      })
      .from(karyaCredits)
      .innerJoin(karyas, eq(karyas.id, karyaCredits.karyaId))
      .where(
        and(
          eq(karyaCredits.kreatorId, kreatorId),
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
        ),
      )
      .orderBy(desc(karyas.year), asc(karyas.title));
    return rows;
  }

  async createKreator(input: {
    displayName: string;
    kind?: KreatorKind;
    bio?: string | null;
    originRegion?: string | null;
    links?: KreatorLink[];
  }): Promise<Kreator> {
    const name = input.displayName.trim();
    const slug = await this.uniqueSlug(slugifyKreator(name));
    const now = new Date();
    const id = generateId();
    await this.db.insert(kreators).values({
      id,
      slug,
      displayName: name,
      kind: input.kind ?? 'person',
      bio: input.bio?.trim() || null,
      originRegion: input.originRegion?.trim() || null,
      linksJson: JSON.stringify(input.links ?? []),
      createdAt: now,
      updatedAt: now,
    });
    return (await this.findKreatorById(id))!;
  }

  async updateKreator(
    id: string,
    patch: {
      bio?: string | null;
      originRegion?: string | null;
      links?: KreatorLink[];
      displayName?: string;
      kind?: KreatorKind;
    },
  ): Promise<Kreator> {
    const row = await this.findKreatorById(id);
    if (!row) throw new Error('Kreator tidak ditemukan');
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.bio !== undefined) set.bio = patch.bio?.trim() || null;
    if (patch.originRegion !== undefined) {
      set.originRegion = patch.originRegion?.trim() || null;
    }
    if (patch.links !== undefined) set.linksJson = JSON.stringify(patch.links);
    if (patch.displayName !== undefined) set.displayName = patch.displayName.trim();
    if (patch.kind !== undefined) set.kind = patch.kind;
    await this.db.update(kreators).set(set).where(eq(kreators.id, id));
    return (await this.findKreatorById(id))!;
  }

  async linkCredit(creditId: string, kreatorId: string): Promise<void> {
    await this.db
      .update(karyaCredits)
      .set({ kreatorId, updatedAt: new Date() })
      .where(eq(karyaCredits.id, creditId));
  }

  /** Isi kreator_id untuk credit yang masih null tapi punya name_text. */
  async resolveCreditsKreatorIds(credits: KaryaCredit[]): Promise<KaryaCredit[]> {
    const cache = new Map<string, string>();
    const out: KaryaCredit[] = [];
    for (const c of credits) {
      if (c.kreatorId) {
        out.push(c);
        continue;
      }
      const name = c.nameText.trim();
      if (!name) {
        out.push(c);
        continue;
      }
      const key = name.toLowerCase();
      let id = cache.get(key);
      if (!id) {
        const k = await this.findOrCreateKreator(name);
        id = k.id;
        cache.set(key, id);
      }
      out.push({ ...c, kreatorId: id });
    }
    return out;
  }

  async insertClaim(input: {
    kreatorId: string;
    userId: string;
    proofNote: string;
  }): Promise<KreatorClaim> {
    const id = generateId();
    await this.db.insert(kreatorClaims).values({
      id,
      kreatorId: input.kreatorId,
      userId: input.userId,
      proofNote: input.proofNote.trim(),
      status: 'pending',
    });
    const created = await this.findClaimById(id);
    if (!created) throw new Error('Klaim kreator gagal dibuat');
    return created;
  }

  async findClaimById(id: string): Promise<KreatorClaim | null> {
    const [row] = await this.db
      .select()
      .from(kreatorClaims)
      .where(eq(kreatorClaims.id, id))
      .limit(1);
    return row ? mapClaim(row) : null;
  }

  async findPendingClaim(kreatorId: string, userId: string): Promise<KreatorClaim | null> {
    const [row] = await this.db
      .select()
      .from(kreatorClaims)
      .where(
        and(
          eq(kreatorClaims.kreatorId, kreatorId),
          eq(kreatorClaims.userId, userId),
          eq(kreatorClaims.status, 'pending'),
        ),
      )
      .limit(1);
    return row ? mapClaim(row) : null;
  }

  async listClaimsByUser(userId: string): Promise<KreatorClaimWithMeta[]> {
    const rows = await this.db
      .select({
        claim: kreatorClaims,
        kreatorSlug: kreators.slug,
        kreatorDisplayName: kreators.displayName,
      })
      .from(kreatorClaims)
      .innerJoin(kreators, eq(kreators.id, kreatorClaims.kreatorId))
      .where(eq(kreatorClaims.userId, userId))
      .orderBy(desc(kreatorClaims.createdAt))
      .limit(50);
    return rows.map((r) => ({
      ...mapClaim(r.claim),
      kreatorSlug: r.kreatorSlug,
      kreatorDisplayName: r.kreatorDisplayName,
    }));
  }

  async listClaimsByStatus(
    status: KreatorClaim['status'],
  ): Promise<KreatorClaimWithMeta[]> {
    const rows = await this.db
      .select({
        claim: kreatorClaims,
        kreatorSlug: kreators.slug,
        kreatorDisplayName: kreators.displayName,
      })
      .from(kreatorClaims)
      .innerJoin(kreators, eq(kreators.id, kreatorClaims.kreatorId))
      .where(eq(kreatorClaims.status, status))
      .orderBy(desc(kreatorClaims.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...mapClaim(r.claim),
      kreatorSlug: r.kreatorSlug,
      kreatorDisplayName: r.kreatorDisplayName,
    }));
  }

  async listPendingClaims(): Promise<KreatorClaimWithMeta[]> {
    return this.listClaimsByStatus('pending');
  }

  async setClaimStatus(
    id: string,
    status: KreatorClaim['status'],
    rejectReason?: string | null,
  ): Promise<void> {
    await this.db
      .update(kreatorClaims)
      .set({
        status,
        rejectReason: rejectReason?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(kreatorClaims.id, id));
  }

  async approveClaimExclusive(claimId: string): Promise<KreatorClaim> {
    return this.db.transaction(async (tx) => {
      const [claim] = await tx
        .select()
        .from(kreatorClaims)
        .where(eq(kreatorClaims.id, claimId))
        .limit(1);
      if (!claim) throw new Error('Klaim tidak ditemukan');
      const now = new Date();
      await tx
        .update(kreatorClaims)
        .set({ status: 'approved', updatedAt: now, rejectReason: null })
        .where(eq(kreatorClaims.id, claimId));
      await tx
        .update(kreatorClaims)
        .set({
          status: 'rejected',
          rejectReason: 'Sudah ada klaim lain yang disetujui untuk kreator ini',
          updatedAt: now,
        })
        .where(
          and(
            eq(kreatorClaims.kreatorId, claim.kreatorId),
            eq(kreatorClaims.status, 'pending'),
            ne(kreatorClaims.id, claimId),
          ),
        );
      const approved = await tx
        .select()
        .from(kreatorClaims)
        .where(eq(kreatorClaims.id, claimId))
        .limit(1);
      return mapClaim(approved[0]!);
    });
  }

  async findApprovedClaimant(kreatorId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: kreatorClaims.userId })
      .from(kreatorClaims)
      .where(
        and(eq(kreatorClaims.kreatorId, kreatorId), eq(kreatorClaims.status, 'approved')),
      )
      .orderBy(desc(kreatorClaims.updatedAt))
      .limit(1);
    return row?.userId ?? null;
  }
}