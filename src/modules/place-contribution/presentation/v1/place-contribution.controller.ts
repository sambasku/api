import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { PlaceContribution } from '../../infrastructure/place-contribution.repository.impl';
import type { PlaceContributionUseCases } from '../../application/place-contribution.use-cases';
import type { submitContributionBodySchema } from './place-contribution.validator';

function serialize(row: PlaceContribution) {
  const p = row.payload;
  return {
    id: row.id,
    user_id: row.userId,
    place_id: row.placeId,
    status: row.status,
    created_at: Math.floor(row.createdAt.getTime() / 1000),
    reviewed_at: row.reviewedAt ? Math.floor(row.reviewedAt.getTime() / 1000) : null,
    payload: {
      slug: p.slug,
      name: p.name,
      category: p.category,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      maps_url: p.mapsUrl,
      short_description: p.shortDescription,
      region_id: p.regionId,
      village_id: p.villageId,
      hours: p.hours,
      contact: p.contact,
      images: p.images.map((img) => ({ url: img.url, is_main: !!img.isMain })),
    },
  };
}

function toPayload(body: z.infer<typeof submitContributionBodySchema>) {
  return {
    slug: body.slug,
    name: body.name,
    category: body.category,
    type: body.type ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    mapsUrl: body.maps_url ?? null,
    shortDescription: body.short_description,
    regionId: body.region_id ?? null,
    villageId: body.village_id ?? null,
    hours: body.hours ?? null,
    contact: body.contact ?? null,
    images: (body.images ?? []).map((img) => ({ url: img.url, isMain: img.is_main })),
  };
}

export class PlaceContributionController {
  constructor(private readonly uc: PlaceContributionUseCases) {}

  submit(c: Context<{ Variables: AppVariables }>, body: z.infer<typeof submitContributionBodySchema>) {
    const userId = c.get('user')!.user_id;
    return this.uc
      .submit(userId, body.place_id ?? null, toPayload(body))
      .then((row) => c.json({ success: true as const, data: serialize(row) }));
  }

  mine(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .mine(c.get('user')!.user_id)
      .then((rows) => c.json({ success: true as const, data: { items: rows.map(serialize) } }));
  }

  cancel(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .cancel(c.get('user')!.user_id, id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  listPending(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .listPending()
      .then((rows) => c.json({ success: true as const, data: { items: rows.map(serialize) } }));
  }

  approve(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc.approve(id).then(() => c.json({ success: true as const, data: null }));
  }

  reject(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc.reject(id).then(() => c.json({ success: true as const, data: null }));
  }
}
