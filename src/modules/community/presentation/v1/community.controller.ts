import type { Context } from 'hono';
import type { z } from 'zod';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type {
  CommunityOrg,
  CommunityOrgFields,
  CommunityProposal,
} from '../../domain/community';
import type { CommunityUseCases } from '../../application/community.use-cases';
import type {
  adminProposalListQuerySchema,
  approveCommunityProposalSchema,
  communityOrgFieldsSchema,
  communityOrgPatchSchema,
  listCommunityQuerySchema,
  rejectCommunityProposalSchema,
  setCommunityStatusSchema,
  submitCommunityProposalSchema,
} from './community.validator';

function requireUserId(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user.user_id;
}

function categoryWire(row: { categoryId: string; categoryName: string | null }) {
  return {
    category_id: row.categoryId,
    /** Alias id (client lama). */
    category: row.categoryId,
    category_name: row.categoryName,
  };
}

function toOrgWire(row: CommunityOrg, admin = false) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ...categoryWire(row),
    description: row.description,
    logo_url: row.logoUrl,
    cover_url: row.coverUrl,
    is_featured_kind: row.isFeaturedKind,
    created_at: row.createdAt.toISOString(),
    updated_at: (row.updatedAt ?? row.createdAt).toISOString(),
    ...(admin
      ? {
          status: row.status,
          author_id: row.authorId,
        }
      : {}),
  };
}

function toProposalWire(row: CommunityProposal) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    logo_url: row.logoUrl,
    ...categoryWire(row),
    status: row.status,
    review_note: row.reviewNote,
    community_org_id: row.communityOrgId,
    username: row.username,
    user_id: row.userId,
    created_at: row.createdAt.toISOString(),
    updated_at: (row.updatedAt ?? row.createdAt).toISOString(),
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
  };
}

function fieldsFrom(
  body: z.infer<typeof communityOrgFieldsSchema>,
): CommunityOrgFields {
  return {
    name: body.name,
    categoryId: body.category_id,
    description: body.description,
    logoUrl: body.logo_url ?? null,
    coverUrl: body.cover_url ?? null,
    isFeaturedKind: body.is_featured_kind ?? null,
  };
}

export class CommunityController {
  constructor(private readonly uc: CommunityUseCases) {}

  async listCategories(c: Context<{ Variables: AppVariables }>) {
    const items = await this.uc.listCategories();
    return c.json({ success: true as const, data: { items } });
  }

  async listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listCommunityQuerySchema>,
  ) {
    const result = await this.uc.listPublic({
      categoryId: query.category_id ?? query.category,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
    return c.json({
      success: true as const,
      data: {
        items: result.items.map((r) => toOrgWire(r)),
        next_cursor: result.nextCursor,
      },
    });
  }

  async listFeatured(c: Context<{ Variables: AppVariables }>) {
    const items = await this.uc.listFeatured();
    return c.json({
      success: true as const,
      data: { items: items.map((r) => toOrgWire(r)) },
    });
  }

  async getPublic(c: Context<{ Variables: AppVariables }>, slug: string) {
    const row = await this.uc.getPublished(slug);
    return c.json({ success: true as const, data: toOrgWire(row) });
  }

  async submitProposal(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitCommunityProposalSchema>,
  ) {
    const row = await this.uc.submitProposal(requireUserId(c), {
      name: body.name,
      description: body.description,
      logoUrl: body.logo_url,
      categoryId: body.category_id ?? body.category,
    });
    return c.json({ success: true as const, data: toProposalWire(row) }, 201);
  }

  async listMine(c: Context<{ Variables: AppVariables }>) {
    const items = await this.uc.listMine(requireUserId(c));
    return c.json({
      success: true as const,
      data: { items: items.map(toProposalWire) },
    });
  }

  async cancelProposal(c: Context<{ Variables: AppVariables }>, id: string) {
    await this.uc.cancelProposal(id, requireUserId(c));
    return c.json({ success: true as const, data: { ok: true } });
  }

  async adminListOrgs(c: Context<{ Variables: AppVariables }>) {
    const items = await this.uc.listManage();
    return c.json({
      success: true as const,
      data: { items: items.map((r) => toOrgWire(r, true)) },
    });
  }

  async adminCreateOrg(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof communityOrgFieldsSchema>,
  ) {
    const row = await this.uc.adminCreate(fieldsFrom(body), requireUserId(c));
    return c.json({ success: true as const, data: toOrgWire(row, true) }, 201);
  }

  async adminUpdateOrg(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof communityOrgPatchSchema>,
  ) {
    const patch: Partial<CommunityOrgFields> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.category_id !== undefined) patch.categoryId = body.category_id;
    if (body.description !== undefined) patch.description = body.description;
    if (body.logo_url !== undefined) patch.logoUrl = body.logo_url;
    if (body.cover_url !== undefined) patch.coverUrl = body.cover_url;
    if (body.is_featured_kind !== undefined) {
      patch.isFeaturedKind = body.is_featured_kind;
    }
    const row = await this.uc.adminUpdate(id, patch, {
      actorId: requireUserId(c),
    });
    return c.json({ success: true as const, data: toOrgWire(row, true) });
  }

  async adminSetStatus(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof setCommunityStatusSchema>,
  ) {
    await this.uc.adminSetStatus(id, body.status, { actorId: requireUserId(c) });
    return c.json({ success: true as const, data: { ok: true } });
  }

  async adminListProposals(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof adminProposalListQuerySchema>,
  ) {
    const items = await this.uc.listAdminProposals(query.status);
    return c.json({
      success: true as const,
      data: { items: items.map(toProposalWire) },
    });
  }

  async adminApprove(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof approveCommunityProposalSchema>,
  ) {
    const row = await this.uc.approveProposal(id, requireUserId(c), {
      categoryId: body.category_id,
      name: body.name,
      description: body.description,
      logoUrl: body.logo_url,
      isFeaturedKind: body.is_featured_kind,
    });
    return c.json({ success: true as const, data: toOrgWire(row, true) });
  }

  async adminReject(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof rejectCommunityProposalSchema>,
  ) {
    await this.uc.rejectProposal(id, requireUserId(c), body.note);
    return c.json({ success: true as const, data: { ok: true } });
  }
}
