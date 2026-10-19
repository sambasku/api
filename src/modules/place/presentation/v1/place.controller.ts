import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { Place } from '../../domain/entities/place.entity';
import type {
  CreatePlaceUseCase,
  DeletePlaceUseCase,
  GetPlaceBySlugUseCase,
  ListPlacesUseCase,
  UpdatePlaceUseCase,
} from '../../application/use-cases/place.use-cases';
import type { z } from 'zod';
import type {
  createPlaceBodySchema,
  listPlacesQuerySchema,
  updatePlaceBodySchema,
} from './validators/place.validator';

function serialize(p: Place) {
  return {
    id: p.id,
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
    author_id: p.authorId,
    sources: p.sources.map((s) => ({
      name: s.name,
      type: s.type,
      address: s.address,
      license: s.license ?? null,
      license_url: s.licenseUrl ?? null,
    })),
    images: p.images.map((img) => ({
      id: img.id,
      url: img.url,
      is_main: img.isMain,
      sort_order: img.sortOrder,
      attribution: img.attribution
        ? {
            name: img.attribution.name,
            provider: img.attribution.provider,
            url: img.attribution.url ?? null,
            license: img.attribution.license ?? null,
            license_url: img.attribution.licenseUrl ?? null,
            source: img.attribution.source ?? null,
            authorId: img.attribution.authorId ?? null,
          }
        : null,
    })),
    status: p.status,
    created_at: Math.floor(p.createdAt.getTime() / 1000),
    updated_at: p.updatedAt ? Math.floor(p.updatedAt.getTime() / 1000) : null,
  };
}

function mapImages(
  images?: z.infer<typeof createPlaceBodySchema>['images'],
) {
  return images?.map((img) => ({
    url: img.url,
    isMain: img.is_main,
    sortOrder: img.sort_order,
    attribution: img.attribution
      ? {
          name: img.attribution.name,
          provider: img.attribution.provider,
          url: img.attribution.url,
          license: img.attribution.license,
          licenseUrl: img.attribution.license_url,
          source: img.attribution.source,
          authorId: img.attribution.authorId,
        }
      : null,
  }));
}

function mapSources(
  sources?: z.infer<typeof createPlaceBodySchema>['sources'],
) {
  return sources?.map((s) => ({
    name: s.name,
    type: s.type,
    address: s.address,
    license: s.license,
    licenseUrl: s.license_url,
  }));
}

export class PlaceController {
  constructor(
    private readonly createUc: CreatePlaceUseCase,
    private readonly updateUc: UpdatePlaceUseCase,
    private readonly deleteUc: DeletePlaceUseCase,
    private readonly listUc: ListPlacesUseCase,
    private readonly getBySlugUc: GetPlaceBySlugUseCase,
  ) {}

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listPlacesQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        category: query.category,
        regionId: query.region_id,
        villageId: query.village_id,
        villageUnset: query.village_unset === '1',
        q: query.q,
        publicOnly: true,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.getBySlugUc
      .execute(slug, true)
      .then((p) => c.json({ success: true as const, data: serialize(p) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listPlacesQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        category: query.category,
        regionId: query.region_id,
        villageId: query.village_id,
        villageUnset: query.village_unset === '1',
        q: query.q,
        status: query.status,
        publicOnly: false,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createPlaceBodySchema>,
  ) {
    return this.createUc
      .execute({
        id: body.id,
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
        authorId: body.author_id ?? null,
        sources: mapSources(body.sources),
        images: mapImages(body.images),
        status: body.status,
      })
      .then((p) => c.json({ success: true as const, data: serialize(p) }));
  }

  update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updatePlaceBodySchema>,
  ) {
    return this.updateUc
      .execute({
        id,
        slug: body.slug,
        name: body.name,
        category: body.category,
        type: body.type,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        shortDescription: body.short_description,
        regionId: body.region_id,
        villageId: body.village_id,
        hours: body.hours,
        contact: body.contact,
        authorId: body.author_id,
        sources: mapSources(body.sources),
        images: mapImages(body.images),
        status: body.status,
      })
      .then((p) => c.json({ success: true as const, data: serialize(p) }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }
}
