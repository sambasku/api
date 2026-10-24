import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { UsahaContributionUseCases } from '../../application/usaha-contribution.use-cases';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type {
  NewUsahaPayload,
  UsahaContribution,
  UsahaContributionPayload,
  UsahaContributionWithUsaha,
} from '../../domain/usaha-contribution.entity';
import type {
  listUsahaContributionsQuerySchema,
  submitManagerChangeBodySchema,
  submitUsahaContributionBodySchema,
} from './validators/usaha-contribution.validator';

function serialize(r: UsahaContribution | UsahaContributionWithUsaha) {
  const withUsaha = r as UsahaContributionWithUsaha;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    usaha_id: r.usahaId,
    usaha_slug: withUsaha.usahaSlug ?? null,
    usaha_name: withUsaha.usahaName ?? null,
    item_id: r.itemId,
    fields: r.lockedFields ? r.lockedFields.split(',') : [],
    payload: r.payload as Record<string, unknown>,
    wants_claim: r.wantsClaim,
    result_usaha_id: r.resultUsahaId,
    revision_note: r.revisionNote,
    reject_reason_code: r.rejectReasonCode,
    reject_reason_text: r.rejectReasonText,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
    reviewed_at: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

function toNewPayload(
  body: z.infer<typeof submitUsahaContributionBodySchema>,
): NewUsahaPayload {
  return {
    name: body.name,
    regionId: body.region_id,
    description: body.description ?? null,
    categoryId: body.category_id ?? null,
    kind: body.kind,
    villageId: body.village_id ?? null,
    addressText: body.address_text ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    phone: body.phone ?? null,
    whatsapp: body.whatsapp ?? null,
    website: body.website ?? null,
    socialUrl: body.social_url ?? null,
    coverUrl: body.cover_url ?? null,
    items: body.items?.map((it) => ({
      name: it.name,
      description: it.description ?? null,
      priceText: it.price_text ?? null,
      imageUrl: it.image_url ?? null,
    })),
  };
}

export class UsahaContributionController {
  constructor(private readonly uc: UsahaContributionUseCases) {}

  private actorId(c: Context<{ Variables: AppVariables }>): string {
    return c.get('user')?.user_id ?? ANONIM_USER_ID;
  }

  private requestId(c: Context<{ Variables: AppVariables }>): string | null {
    return c.get('requestId') ?? null;
  }

  submit(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitUsahaContributionBodySchema>,
  ) {
    return this.uc
      .submit(this.actorId(c), {
        payload: toNewPayload(body),
        wantsClaim: body.wants_claim ?? false,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  mine(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .mine(this.actorId(c))
      .then((items) =>
        c.json({
          success: true as const,
          data: { items: items.map(serialize) },
        }),
      );
  }

  cancel(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .cancel(this.actorId(c), id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  resubmit(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof submitUsahaContributionBodySchema>,
  ) {
    return this.uc
      .resubmit(this.actorId(c), id, {
        payload: toNewPayload(body),
        wantsClaim: body.wants_claim ?? false,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  managerChange(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitManagerChangeBodySchema>,
  ) {
    const user = c.get('user');
    return this.uc
      .submitManagerChange(user?.user_id ?? '', {
        kind: body.kind,
        usahaId: body.usaha_id,
        itemId: body.item_id ?? null,
        payload: body.payload as UsahaContributionPayload,
        fields: body.fields,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listUsahaContributionsQuerySchema>,
  ) {
    return this.uc
      .list({ status: query.status, kind: query.kind })
      .then((items) =>
        c.json({
          success: true as const,
          data: { items: items.map(serialize) },
        }),
      );
  }

  approve(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .approve(
        id,
        c.get('user')?.user_id,
        this.requestId(c),
      )
      .then(() => c.json({ success: true as const, data: null }));
  }

  reject(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { reason_code: string; reason_text?: string | null },
  ) {
    return this.uc
      .reject(
        id,
        body.reason_code,
        body.reason_text,
        c.get('user')?.user_id,
        this.requestId(c),
      )
      .then(() => c.json({ success: true as const, data: null }));
  }

  requestRevision(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { note: string },
  ) {
    return this.uc
      .requestRevision(
        id,
        body.note,
        c.get('user')?.user_id,
        this.requestId(c),
      )
      .then(() => c.json({ success: true as const, data: null }));
  }
}
