import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import { NotFoundError } from '@/shared/errors/app-error';
import type {
  Cuisine,
  CuisineDetail,
  CuisinePlaceLink,
  CulinaryPlace,
  CulinaryPlaceDetail,
} from '../../domain/entities/culinary.entity';
import type {
  CulinaryRepository,
  CreateCuisineInput,
  CreatePlaceInput,
  UpdateCuisineInput,
  UpdatePlaceInput,
} from '../../domain/repositories/culinary.repository';
import {
  FindCulinaryDuplicatesUseCase,
  GetCuisineBySlugUseCase,
  GetCulinaryPlaceBySlugUseCase,
  ListCulinaryCategoriesUseCase,
  ListCuisinesUseCase,
  ListCulinaryPlacesUseCase,
  RestoreCulinaryUseCase,
  RestrictCulinaryUseCase,
  DeleteCulinaryUseCase,
  imagesToJson,
  sourcesToJson,
} from '../../application/use-cases/culinary.use-cases';
import type {
  createCuisineBodySchema,
  createLinkBodySchema,
  createPlaceBodySchema,
  listCuisinesQuerySchema,
  listPlacesQuerySchema,
  updateCuisineBodySchema,
  updateLinkBodySchema,
  updatePlaceBodySchema,
} from './validators/culinary.validator';

type ListCuisinesQuery = z.infer<typeof listCuisinesQuerySchema>;
type ListPlacesQuery = z.infer<typeof listPlacesQuerySchema>;

export function serializeLink(l: CuisinePlaceLink) {
  return {
    id: l.id,
    cuisine_id: l.cuisineId,
    place_id: l.placeId,
    availability: l.availability,
    note: l.note,
    cuisine_name: l.cuisineName,
    cuisine_slug: l.cuisineSlug,
    place_name: l.placeName,
    place_slug: l.placeSlug,
  };
}

export function serializeCuisine(c: Cuisine | CuisineDetail) {
  const places = 'places' in c ? c.places : undefined;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    category_id: c.categoryId,
    category: c.category,
    origin_region: c.originRegion,
    images: c.images.map((img) => ({
      url: img.url,
      is_main: img.isMain,
      attribution: img.attribution,
    })),
    ingredients: c.ingredients,
    serving_suggestion: c.servingSuggestion,
    tags: c.tags,
    sources: c.sources.map((s) => ({
      name: s.name,
      type: s.type,
      address: s.address,
      license: s.license ?? null,
      license_url: s.licenseUrl ?? null,
    })),
    license: c.license,
    publish_status: c.publishStatus,
    restricted_reason: c.restrictedReason,
    restricted_at: c.restrictedAt ? c.restrictedAt.toISOString() : null,
    author_id: c.authorId,
    published_at: c.publishedAt ? c.publishedAt.toISOString() : null,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt ? c.updatedAt.toISOString() : null,
    places: places?.map(serializeLink),
  };
}

export function serializePlace(p: CulinaryPlace | CulinaryPlaceDetail) {
  const cuisines = 'cuisines' in p ? p.cuisines : undefined;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    description: p.description,
    location_hint: p.locationHint,
    address_text: p.addressText,
    lat: p.lat,
    lng: p.lng,
    maps_url: p.mapsUrl,
    phone: p.phone,
    whatsapp: p.whatsapp,
    website: p.website,
    social_url: p.socialUrl,
    cover_url: p.coverUrl,
    operational_status: p.operationalStatus,
    publish_status: p.publishStatus,
    restricted_reason: p.restrictedReason,
    restricted_at: p.restrictedAt ? p.restrictedAt.toISOString() : null,
    manager_id: p.managerId,
    author_id: p.authorId,
    published_at: p.publishedAt ? p.publishedAt.toISOString() : null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt ? p.updatedAt.toISOString() : null,
    cuisines: cuisines?.map(serializeLink),
  };
}

export class CulinaryController {
  constructor(
    private readonly repo: CulinaryRepository,
    private readonly listCuisinesUc: ListCuisinesUseCase,
    private readonly getCuisineUc: GetCuisineBySlugUseCase,
    private readonly listPlacesUc: ListCulinaryPlacesUseCase,
    private readonly getPlaceUc: GetCulinaryPlaceBySlugUseCase,
    private readonly listCategoriesUc: ListCulinaryCategoriesUseCase,
    private readonly cuisineDuplicatesUc: FindCulinaryDuplicatesUseCase,
    private readonly placeDuplicatesUc: FindCulinaryDuplicatesUseCase,
    private readonly restrictCuisineUc: RestrictCulinaryUseCase,
    private readonly restoreCuisineUc: RestoreCulinaryUseCase,
    private readonly deleteCuisineUc: DeleteCulinaryUseCase,
    private readonly restrictPlaceUc: RestrictCulinaryUseCase,
    private readonly restorePlaceUc: RestoreCulinaryUseCase,
    private readonly deletePlaceUc: DeleteCulinaryUseCase,
  ) {}

  // ------------------------------------------------------------- publik --

  listCuisines(
    c: Context<{ Variables: AppVariables }>,
    query: ListCuisinesQuery,
  ) {
    return this.listCuisinesUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        q: query.q,
        publicOnly: true,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializeCuisine),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  getCuisine(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.getCuisineUc
      .execute(slug, true)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  listPlaces(
    c: Context<{ Variables: AppVariables }>,
    query: ListPlacesQuery,
  ) {
    return this.listPlacesUc
      .execute({
        limit: query.limit,
        before: query.before,
        type: query.type,
        operationalStatus: query.operational_status,
        q: query.q,
        publicOnly: true,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializePlace),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  getPlace(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.getPlaceUc
      .execute(slug, true)
      .then((place) => c.json({ success: true as const, data: serializePlace(place as CulinaryPlace) }));
  }

  listCategories(c: Context<{ Variables: AppVariables }>, publicOnly: boolean) {
    return this.listCategoriesUc.execute(publicOnly).then((items) =>
      c.json({ success: true as const, data: { items } }),
    );
  }
  cuisineDuplicates(
    c: Context<{ Variables: AppVariables }>,
    q: string,
    excludeId?: string,
  ) {
    return this.cuisineDuplicatesUc
      .execute(q, excludeId)
      .then((items) => c.json({ success: true as const, data: { items } }));
  }

  placeDuplicates(
    c: Context<{ Variables: AppVariables }>,
    q: string,
    excludeId?: string,
  ) {
    return this.placeDuplicatesUc
      .execute(q, excludeId)
      .then((items) => c.json({ success: true as const, data: { items } }));
  }

  // --------------------------------------------------------------- admin --

  listCuisinesAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: ListCuisinesQuery,
  ) {
    return this.listCuisinesUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        q: query.q,
        status: query.status,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializeCuisine),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  listPlacesAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: ListPlacesQuery,
  ) {
    return this.listPlacesUc
      .execute({
        limit: query.limit,
        before: query.before,
        type: query.type,
        operationalStatus: query.operational_status,
        q: query.q,
        status: query.status,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serializePlace),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  restrictCuisine(c: Context<{ Variables: AppVariables }>, id: string, reason: string) {
    return this.restrictCuisineUc
      .execute(id, reason)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  restoreCuisine(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.restoreCuisineUc
      .execute(id)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  deleteCuisine(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteCuisineUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  restrictPlace(c: Context<{ Variables: AppVariables }>, id: string, reason: string) {
    return this.restrictPlaceUc
      .execute(id, reason)
      .then((place) => c.json({ success: true as const, data: serializePlace(place as CulinaryPlace) }));
  }

  restorePlace(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.restorePlaceUc
      .execute(id)
      .then((place) => c.json({ success: true as const, data: serializePlace(place as CulinaryPlace) }));
  }

  deletePlace(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deletePlaceUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  // ------------------------------------------------ admin: tulis langsung --

  private cuisineInput(
    body: z.infer<typeof createCuisineBodySchema> | z.infer<typeof updateCuisineBodySchema>,
  ): Partial<CreateCuisineInput & UpdateCuisineInput> {
    return {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.category_id !== undefined ? { categoryId: body.category_id } : {}),
      ...(body.origin_region !== undefined
        ? { originRegion: body.origin_region }
        : {}),
      ...(body.images !== undefined
        ? {
            imagesJson: imagesToJson(
              body.images.map((img) => ({
                url: img.url,
                isMain: img.is_main,
                attribution: img.attribution ?? undefined,
              })),
            )
          }
        : {}),
      ...(body.ingredients !== undefined
        ? { ingredientsJson: JSON.stringify(body.ingredients) }
        : {}),
      ...(body.serving_suggestion !== undefined
        ? { servingSuggestion: body.serving_suggestion }
        : {}),
      ...(body.tags !== undefined ? { tagsJson: JSON.stringify(body.tags) } : {}),
      ...(body.sources !== undefined ? { sourcesJson: sourcesToJson(body.sources) } : {}),
      ...(body.license !== undefined ? { license: body.license } : {}),
      ...(body.publish_status !== undefined
        ? { publishStatus: body.publish_status }
        : {}),
    };
  }

  private placeInput(
    body: z.infer<typeof createPlaceBodySchema> | z.infer<typeof updatePlaceBodySchema>,
  ): Partial<CreatePlaceInput & UpdatePlaceInput> {
    return {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.location_hint !== undefined
        ? { locationHint: body.location_hint }
        : {}),
      ...(body.address_text !== undefined
        ? { addressText: body.address_text }
        : {}),
      ...(body.lat !== undefined ? { lat: body.lat } : {}),
      ...(body.lng !== undefined ? { lng: body.lng } : {}),
      ...(body.maps_url !== undefined ? { mapsUrl: body.maps_url } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
      ...(body.social_url !== undefined ? { socialUrl: body.social_url } : {}),
      ...(body.cover_url !== undefined ? { coverUrl: body.cover_url } : {}),
      ...(body.operational_status !== undefined
        ? { operationalStatus: body.operational_status }
        : {}),
      ...(body.publish_status !== undefined
        ? { publishStatus: body.publish_status }
        : {}),
    };
  }

  createCuisine(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createCuisineBodySchema>,
  ) {
    const input = {
      ...this.cuisineInput(body),
      slug: body.slug,
      name: body.name,
      publishStatus: 'published',
      authorId: c.get('user')?.user_id ?? null,
    } as CreateCuisineInput;
    return this.repo
      .createCuisine(input)
      .then((cuisine) => c.json({ success: true as const, data: serializeCuisine(cuisine as Cuisine) }));
  }

  updateCuisine(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateCuisineBodySchema>,
  ) {
    const input = { id, ...this.cuisineInput(body) } as UpdateCuisineInput;
    return this.repo.updateCuisine(input).then((cuisine) => {
      if (!cuisine) {
        throw new NotFoundError('CUISINE_NOT_FOUND', 'Kuliner tidak ditemukan');
      }
      return c.json({ success: true as const, data: serializeCuisine(cuisine) });
    });
  }

  createPlace(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createPlaceBodySchema>,
  ) {
    const input = {
      ...this.placeInput(body),
      slug: body.slug,
      name: body.name,
      publishStatus: 'published',
      authorId: c.get('user')?.user_id ?? null,
    } as CreatePlaceInput;
    return this.repo
      .createPlace(input)
      .then((place) => c.json({ success: true as const, data: serializePlace(place as CulinaryPlace) }));
  }

  updatePlace(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updatePlaceBodySchema>,
  ) {
    const input = { id, ...this.placeInput(body) } as UpdatePlaceInput;
    return this.repo.updatePlace(input).then((place) => {
      if (!place) {
        throw new NotFoundError('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
      }
      return c.json({ success: true as const, data: serializePlace(place) });
    });
  }

  createLink(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createLinkBodySchema>,
  ) {
    return this.repo
      .createLink({
        cuisineId: body.cuisine_id,
        placeId: body.place_id,
        availability: body.availability,
        note: body.note ?? null,
        publishStatus: body.publish_status ?? 'published',
        authorId: c.get('user')?.user_id ?? null,
      })
      .then((link) => c.json({ success: true as const, data: serializeLink(link) }));
  }

  updateLink(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateLinkBodySchema>,
  ) {
    return this.repo
      .updateLink({
        id,
        availability: body.availability,
        note: body.note,
        publishStatus: body.publish_status,
      })
      .then((link) => {
        if (!link) {
          throw new NotFoundError('LINK_NOT_FOUND', 'Relasi tidak ditemukan');
        }
        return c.json({ success: true as const, data: serializeLink(link) });
      });
  }

  deleteLink(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.repo.softDeleteLink(id).then((ok) => {
      if (!ok) {
        throw new NotFoundError('LINK_NOT_FOUND', 'Relasi tidak ditemukan');
      }
      return c.json({ success: true as const, data: null });
    });
  }
}