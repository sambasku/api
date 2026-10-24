import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { CulinaryContributionUseCases } from '../../application/culinary-contribution.use-cases';
import type {
  CulinaryContribution,
  CulinaryContributionPayload,
  CulinaryContributionWithTarget,
  NewCuisinePayload,
  NewPlacePayload,
} from '../../domain/culinary-contribution.entity';
import type {
  listCulinaryContributionsQuerySchema,
  submitCulinaryChangeBodySchema,
  submitNewCuisineBodySchema,
  submitNewPlaceBodySchema,
} from './validators/culinary-contribution.validator';

function serialize(r: CulinaryContribution | CulinaryContributionWithTarget) {
  const withTarget = r as CulinaryContributionWithTarget;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    cuisine_id: r.cuisineId,
    cuisine_slug: withTarget.cuisineSlug ?? null,
    cuisine_name: withTarget.cuisineName ?? null,
    place_id: r.placeId,
    place_slug: withTarget.placeSlug ?? null,
    place_name: withTarget.placeName ?? null,
    link_id: r.linkId,
    fields: r.lockedFields ? r.lockedFields.split(',') : [],
    payload: r.payload as Record<string, unknown>,
    result_cuisine_id: r.resultCuisineId,
    result_place_id: r.resultPlaceId,
    revision_note: r.revisionNote,
    reject_reason_code: r.rejectReasonCode,
    reject_reason_text: r.rejectReasonText,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt ? r.updatedAt.toISOString() : null,
    reviewed_at: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

type ImageIn = NonNullable<NewCuisinePayload['images']>[number];

function toNewCuisine(
  payload: z.infer<typeof submitNewCuisineBodySchema>['payload'],
): NewCuisinePayload {
  return {
    name: payload.name,
    description: payload.description ?? null,
    categoryId: payload.category_id ?? null,
    originRegion: payload.origin_region ?? null,
    images: payload.images?.map(
      (img): ImageIn => ({
        url: img.url,
        isMain: img.is_main === true,
        attribution: img.attribution
          ? {
              name: img.attribution.name,
              provider: img.attribution.provider,
              url: img.attribution.url,
              license: img.attribution.license,
              license_url: img.attribution.license_url,
            }
          : null,
      }),
    ),
    ingredients: payload.ingredients,
    servingSuggestion: payload.serving_suggestion ?? null,
    tags: payload.tags,
    sources: payload.sources?.map((s) => ({
      name: s.name,
      type: s.type ?? 'other',
      address: s.address,
      license: s.license ?? null,
      licenseUrl: s.license_url ?? null,
    })),
  };
}

function toNewPlace(
  payload: z.infer<typeof submitNewPlaceBodySchema>['payload'],
): NewPlacePayload {
  return {
    name: payload.name,
    type: payload.type ?? null,
    description: payload.description ?? null,
    locationHint: payload.location_hint ?? null,
    addressText: payload.address_text ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    mapsUrl: payload.maps_url ?? null,
    phone: payload.phone ?? null,
    whatsapp: payload.whatsapp ?? null,
    website: payload.website ?? null,
    socialUrl: payload.social_url ?? null,
    coverUrl: payload.cover_url ?? null,
  };
}

/** Payload edit tetap bentuk domain (camelCase); kita terima keduanya. */
function normalizeChangePayload(kind: string, raw: Record<string, unknown>) {
  const map: Record<string, string> = {
    category_id: 'categoryId',
    origin_region: 'originRegion',
    serving_suggestion: 'servingSuggestion',
    location_hint: 'locationHint',
    address_text: 'addressText',
    maps_url: 'mapsUrl',
    social_url: 'socialUrl',
    cover_url: 'coverUrl',
    cuisine_slug: 'cuisineSlug',
    place_slug: 'placeSlug',
    operational_status: 'operationalStatus',
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'images' && Array.isArray(value)) {
      out.images = value.map((img) => {
        const i = img as Record<string, unknown>;
        return {
          url: i.url,
          isMain: i.is_main === true || i.isMain === true,
          attribution: (i.attribution ?? null) as ImageIn['attribution'],
        };
      });
      continue;
    }
    out[map[key] ?? key] = value;
  }
  return { kind, payload: out };
}

export class CulinaryContributionController {
  constructor(private readonly uc: CulinaryContributionUseCases) {}

  private actorId(c: Context<{ Variables: AppVariables }>): string {
    return c.get('user')?.user_id ?? ANONIM_USER_ID;
  }

  private requestId(c: Context<{ Variables: AppVariables }>): string | null {
    return c.get('requestId') ?? null;
  }

  submitNew(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitNewCuisineBodySchema> | z.infer<typeof submitNewPlaceBodySchema>,
  ) {
    const input =
      body.kind === 'new_cuisine'
        ? ({ kind: 'new_cuisine', payload: toNewCuisine(body.payload) } as const)
        : ({ kind: 'new_place', payload: toNewPlace(body.payload) } as const);
    return this.uc
      .submit(this.actorId(c), input)
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  mine(c: Context<{ Variables: AppVariables }>) {
    return this.uc.mine(this.actorId(c)).then((items) =>
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
    body: z.infer<typeof submitNewCuisineBodySchema> | z.infer<typeof submitNewPlaceBodySchema>,
  ) {
    const input =
      body.kind === 'new_cuisine'
        ? ({ kind: 'new_cuisine', payload: toNewCuisine(body.payload) } as const)
        : ({ kind: 'new_place', payload: toNewPlace(body.payload) } as const);
    return this.uc
      .resubmit(this.actorId(c), id, input)
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  submitChange(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitCulinaryChangeBodySchema>,
  ) {
    const normalized = normalizeChangePayload(body.kind, body.payload);
    return this.uc
      .submitChange(c.get('user')?.user_id ?? '', {
        kind: body.kind,
        cuisineId: body.cuisine_id ?? null,
        placeId: body.place_id ?? null,
        linkId: body.link_id ?? null,
        payload: normalized.payload as CulinaryContributionPayload,
        fields: body.fields,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listCulinaryContributionsQuerySchema>,
  ) {
    return this.uc.list({ status: query.status, kind: query.kind }).then((items) =>
      c.json({
        success: true as const,
        data: { items: items.map(serialize) },
      }),
    );
  }

  approve(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .approve(id, c.get('user')?.user_id, this.requestId(c))
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
      .requestRevision(id, body.note, c.get('user')?.user_id, this.requestId(c))
      .then(() => c.json({ success: true as const, data: null }));
  }
}
