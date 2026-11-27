import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import {
  toChangeCtx,
  type EntityChangeContext,
  type RecordEntityChange,
} from '@/modules/change-history/application/record-entity-change';
import { communitySnapshot } from '@/modules/change-history/domain/entity-change';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import {
  COMMUNITY_CATEGORY_DEFAULT,
  COMMUNITY_DESC_MAX,
  COMMUNITY_PENDING_CAP,
  slugifyCommunity,
  type CommunityFeaturedKind,
  type CommunityOrg,
  type CommunityOrgFields,
  type CommunityProposal,
  type CommunityProposalStatus,
} from '../domain/community';
import type { CommunityRepository } from '../domain/community.repository';

function assertHttpsUrl(field: string, raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() || null;
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      throw new ValidationError([
        { field, message: 'Tautan harus memakai https' },
      ]);
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError([{ field, message: 'Tautan tidak valid' }]);
  }
}

export class CommunityUseCases {
  constructor(
    private readonly repo: CommunityRepository,
    private readonly activity: RecordActivityEventUseCase,
    private readonly changes?: RecordEntityChange,
  ) {}

  listCategories() {
    return this.repo.listCategories(true);
  }

  listPublic(input: {
    categoryId?: string;
    q?: string;
    cursor?: string | null;
    limit?: number;
  }) {
    return this.repo.listPublished(input);
  }

  listFeatured() {
    return this.repo.listFeatured();
  }

  listManage() {
    return this.repo.listManage();
  }

  async getPublished(slug: string): Promise<CommunityOrg> {
    const row = await this.repo.findPublishedBySlug(slug);
    if (!row) {
      throw new NotFoundError('COMMUNITY_NOT_FOUND', 'Komunitas tidak ditemukan');
    }
    return row;
  }

  async adminCreate(
    fields: CommunityOrgFields,
    authorId: string,
  ): Promise<CommunityOrg> {
    const normalized = await this.normalizeOrg(fields);
    if (normalized.isFeaturedKind) {
      await this.repo.clearFeaturedKind(normalized.isFeaturedKind);
    }
    const slug = await this.uniqueSlug(normalized.name);
    const row = await this.repo.insertOrg({
      ...normalized,
      slug,
      authorId,
    });
    await this.changes?.created('community', row.id, communitySnapshot(row), {
      actorId: authorId,
    });
    await this.emitPublished(row);
    return row;
  }

  async adminUpdate(
    id: string,
    fields: Partial<CommunityOrgFields>,
    ctx?: Partial<EntityChangeContext>,
  ): Promise<CommunityOrg> {
    const before = await this.mustOrg(id);
    const patch: Partial<CommunityOrgFields> = {};
    if (fields.name !== undefined) patch.name = fields.name.trim();
    if (fields.categoryId !== undefined) {
      patch.categoryId = await this.requireCategoryId(fields.categoryId);
    }
    if (fields.description !== undefined) {
      patch.description = this.normalizeDescription(fields.description);
    }
    if (fields.logoUrl !== undefined) {
      patch.logoUrl = assertHttpsUrl('logo_url', fields.logoUrl);
    }
    if (fields.coverUrl !== undefined) {
      patch.coverUrl = assertHttpsUrl('cover_url', fields.coverUrl);
    }
    if (fields.isFeaturedKind !== undefined) {
      patch.isFeaturedKind = fields.isFeaturedKind;
      if (fields.isFeaturedKind) {
        await this.repo.clearFeaturedKind(fields.isFeaturedKind, id);
      }
    }
    await this.repo.updateOrg(id, patch);
    const after = (await this.repo.findById(id))!;
    await this.changes?.updated(
      'community',
      id,
      communitySnapshot(before),
      communitySnapshot(after),
      toChangeCtx(ctx),
    );
    return after;
  }

  async adminSetStatus(
    id: string,
    status: CommunityOrg['status'],
    ctx?: Partial<EntityChangeContext>,
  ): Promise<void> {
    const before = await this.mustOrg(id);
    await this.repo.updateOrg(id, { status });
    await this.changes?.updated(
      'community',
      id,
      communitySnapshot(before),
      communitySnapshot({ ...before, status }),
      toChangeCtx(ctx),
    );
  }

  async submitProposal(
    userId: string,
    input: {
      name: string;
      description: string;
      logoUrl?: string | null;
      categoryId?: string;
    },
  ): Promise<CommunityProposal> {
    if ((await this.repo.countOpenByUser(userId)) >= COMMUNITY_PENDING_CAP) {
      throw new ConflictError(
        'PENDING_CAP',
        'Kamu masih punya 10 usulan yang belum selesai',
      );
    }
    const name = input.name.trim();
    if (name.length < 2) {
      throw new ValidationError([
        { field: 'name', message: 'Nama komunitas minimal 2 karakter' },
      ]);
    }
    const description = this.normalizeDescription(input.description);
    const logoUrl = assertHttpsUrl('logo_url', input.logoUrl);
    const categoryId = await this.requireCategoryId(
      input.categoryId ?? COMMUNITY_CATEGORY_DEFAULT,
    );
    const id = await this.repo.insertProposal({
      userId,
      name,
      description,
      logoUrl,
      categoryId,
    });
    await this.activity.safe({
      kind: 'community_proposal_created',
      actorId: userId,
      targetId: id,
      payload: `Mengusulkan komunitas · "${name}"`,
      dedupeKey: `community_proposal_created:${id}`,
    });
    return (await this.repo.findProposal(id))!;
  }

  listMine(userId: string) {
    return this.repo.listProposals({ userId });
  }

  listAdminProposals(status?: CommunityProposalStatus) {
    return this.repo.listProposals({ status });
  }

  async cancelProposal(id: string, userId: string): Promise<void> {
    const row = await this.repo.findProposal(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('PROPOSAL_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_OPEN', 'Usulan ini sudah ditutup');
    }
    await this.repo.updateProposal(id, { status: 'cancelled' });
    await this.activity.safe({
      kind: 'community_proposal_created',
      actorId: userId,
      targetId: id,
      dedupeKey: `community_proposal_created:${id}`,
      hidden: true,
    });
  }

  async approveProposal(
    id: string,
    reviewerId: string,
    override?: {
      categoryId?: string;
      name?: string;
      description?: string;
      logoUrl?: string | null;
      isFeaturedKind?: CommunityFeaturedKind | null;
    },
  ): Promise<CommunityOrg> {
    const row = await this.mustPending(id);
    const name = (override?.name ?? row.name).trim();
    const description = this.normalizeDescription(
      override?.description ?? row.description,
    );
    const categoryId = await this.requireCategoryId(
      override?.categoryId ?? row.categoryId,
    );
    const logoUrl =
      override?.logoUrl !== undefined
        ? assertHttpsUrl('logo_url', override.logoUrl)
        : row.logoUrl;
    const isFeaturedKind = override?.isFeaturedKind ?? null;
    if (isFeaturedKind) {
      await this.repo.clearFeaturedKind(isFeaturedKind);
    }
    const slug = await this.uniqueSlug(name);
    const created = await this.repo.insertOrg({
      name,
      categoryId,
      description,
      logoUrl,
      coverUrl: null,
      isFeaturedKind,
      slug,
      authorId: row.userId,
    });
    await this.changes?.created('community', created.id, communitySnapshot(created), {
      actorId: row.userId,
      sourceContributionId: id,
    });
    await this.repo.updateProposal(id, {
      status: 'approved',
      communityOrgId: created.id,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      categoryId,
      name,
      description,
      logoUrl,
    });
    await this.emitPublished(created);
    return created;
  }

  async rejectProposal(
    id: string,
    reviewerId: string,
    note?: string | null,
  ): Promise<void> {
    await this.mustPending(id);
    await this.repo.updateProposal(id, {
      status: 'rejected',
      reviewNote: note?.trim() || null,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    await this.activity.safe({
      kind: 'community_proposal_created',
      actorId: null,
      targetId: id,
      dedupeKey: `community_proposal_created:${id}`,
      hidden: true,
    });
  }

  private async requireCategoryId(raw: string): Promise<string> {
    const id = raw.trim();
    const cat = await this.repo.findCategory(id);
    if (!cat) {
      throw new ValidationError([
        {
          field: 'category_id',
          message: 'Kategori tidak valid. Pilih ulang dari daftar.',
        },
      ]);
    }
    return cat.id;
  }

  private async normalizeOrg(fields: CommunityOrgFields): Promise<CommunityOrgFields> {
    const name = fields.name.trim();
    if (name.length < 2) {
      throw new ValidationError([
        { field: 'name', message: 'Nama komunitas minimal 2 karakter' },
      ]);
    }
    return {
      name,
      categoryId: await this.requireCategoryId(fields.categoryId),
      description: this.normalizeDescription(fields.description),
      logoUrl: assertHttpsUrl('logo_url', fields.logoUrl),
      coverUrl: assertHttpsUrl('cover_url', fields.coverUrl),
      isFeaturedKind: fields.isFeaturedKind ?? null,
    };
  }

  private normalizeDescription(raw: string): string {
    const description = raw.trim();
    if (description.length < 1) {
      throw new ValidationError([
        { field: 'description', message: 'Deskripsi wajib diisi' },
      ]);
    }
    if (description.length > COMMUNITY_DESC_MAX) {
      throw new ValidationError([
        {
          field: 'description',
          message: `Deskripsi maksimal ${COMMUNITY_DESC_MAX} karakter`,
        },
      ]);
    }
    return description;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugifyCommunity(name);
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingSlugs(candidates);
    const free = candidates.find((c) => !taken.has(c));
    return free ?? `${base}-${Date.now()}`;
  }

  private async emitPublished(row: CommunityOrg): Promise<void> {
    await this.activity.safe({
      kind: 'community_published',
      actorId: row.authorId,
      targetId: row.id,
      payload: `Menambahkan komunitas · "${row.name}"`,
      dedupeKey: `community_published:${row.id}`,
    });
  }

  private async mustOrg(id: string): Promise<CommunityOrg> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('COMMUNITY_NOT_FOUND', 'Komunitas tidak ditemukan');
    }
    return row;
  }

  private async mustPending(id: string): Promise<CommunityProposal> {
    const row = await this.repo.findProposal(id);
    if (!row) {
      throw new NotFoundError('PROPOSAL_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Usulan ini sudah ditinjau');
    }
    return row;
  }
}
