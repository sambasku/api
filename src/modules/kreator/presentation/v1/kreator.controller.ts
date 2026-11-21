import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { Kreator, KreatorClaimWithMeta } from '../../domain/kreator';
import type { KreatorUseCases } from '../../application/kreator.use-cases';
import type {
  adminClaimsQuerySchema,
  adminKreatorBodySchema,
  adminKreatorUpdateSchema,
  linkCreditBodySchema,
  listKreatorsQuerySchema,
  rejectKreatorClaimSchema,
  submitKreatorClaimSchema,
} from './validators/kreator.validator';

function requireUserId(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user.user_id;
}

function kreatorWire(row: Kreator) {
  return {
    id: row.id,
    slug: row.slug,
    display_name: row.displayName,
    kind: row.kind,
    bio: row.bio,
    origin_region: row.originRegion,
    links: row.links.map((l) => ({ label: l.label, url: l.url })),
    updated_at: (row.updatedAt ?? row.createdAt).toISOString(),
  };
}

function claimPublicWire(row: KreatorClaimWithMeta) {
  return {
    id: row.id,
    kreator_id: row.kreatorId,
    kreator_slug: row.kreatorSlug ?? null,
    kreator_display_name: row.kreatorDisplayName ?? null,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

function claimAdminWire(row: KreatorClaimWithMeta) {
  return {
    ...claimPublicWire(row),
    user_id: row.userId,
    proof_note: row.proofNote,
    reject_reason: row.rejectReason,
  };
}

export class KreatorController {
  constructor(private readonly uc: KreatorUseCases) {}

  async listPublic(c: Context, query: z.infer<typeof listKreatorsQuerySchema>) {
    const items = await this.uc.listPublic({ q: query.q });
    return c.json({
      success: true as const,
      data: { items: items.map(kreatorWire) },
    });
  }

  async getPublic(c: Context, slug: string) {
    const data = await this.uc.getBySlug(slug);
    return c.json({
      success: true as const,
      data: {
        kreator: kreatorWire(data.kreator),
        karyas: data.karyas.map((k) => ({
          id: k.id,
          slug: k.slug,
          title: k.title,
          kind: k.kind,
          year: k.year,
          role: k.role,
        })),
      },
    });
  }

  async submitClaim(
    c: Context,
    slug: string,
    body: z.infer<typeof submitKreatorClaimSchema>,
  ) {
    const row = await this.uc.submitClaim(requireUserId(c), slug, body.proof_note);
    return c.json({ success: true as const, data: claimPublicWire(row) }, 201);
  }

  async mineClaims(c: Context) {
    const items = await this.uc.mineClaims(requireUserId(c));
    return c.json({
      success: true as const,
      data: { items: items.map(claimPublicWire) },
    });
  }

  async adminCreate(c: Context, body: z.infer<typeof adminKreatorBodySchema>) {
    const row = await this.uc.adminCreate({
      displayName: body.display_name,
      kind: body.kind,
      bio: body.bio ?? null,
      originRegion: body.origin_region ?? null,
      links: body.links?.map((l) => ({ label: l.label, url: l.url })),
    });
    return c.json({ success: true as const, data: kreatorWire(row) }, 201);
  }

  async adminUpdate(
    c: Context,
    id: string,
    body: z.infer<typeof adminKreatorUpdateSchema>,
  ) {
    const row = await this.uc.adminUpdate(id, {
      ...(body.display_name !== undefined ? { displayName: body.display_name } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.origin_region !== undefined ? { originRegion: body.origin_region } : {}),
      ...(body.links !== undefined
        ? { links: body.links.map((l) => ({ label: l.label, url: l.url })) }
        : {}),
    });
    return c.json({ success: true as const, data: kreatorWire(row) });
  }

  async linkCredit(c: Context, creditId: string, body: z.infer<typeof linkCreditBodySchema>) {
    await this.uc.linkCredit(creditId, {
      kreatorId: body.kreator_id,
      displayName: body.display_name,
    });
    return c.json({ success: true as const, data: null });
  }

  async listAdminClaims(c: Context, query: z.infer<typeof adminClaimsQuerySchema>) {
    const items = await this.uc.listAdminClaims(query.status);
    return c.json({
      success: true as const,
      data: { items: items.map(claimAdminWire) },
    });
  }

  async approveClaim(c: Context, id: string) {
    await this.uc.approveClaim(id, requireUserId(c));
    return c.json({ success: true as const, data: null });
  }

  async rejectClaim(c: Context, id: string, body: z.infer<typeof rejectKreatorClaimSchema>) {
    await this.uc.rejectClaim(id, body.reason);
    return c.json({ success: true as const, data: null });
  }
}