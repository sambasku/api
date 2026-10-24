import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type {
  UsahaDetail,
  UsahaListItem,
} from '../../domain/entities/usaha.entity';
import type {
  CreateUsahaUseCase,
  DeleteUsahaUseCase,
  FindUsahaDuplicatesUseCase,
  GetUsahaBySlugUseCase,
  ListUsahaCategoriesUseCase,
  ListUsahasUseCase,
  RestoreUsahaUseCase,
  RestrictUsahaUseCase,
  UpdateUsahaUseCase,
} from '../../application/use-cases/usaha.use-cases';
import type {
  createUsahaBodySchema,
  listUsahasQuerySchema,
  updateUsahaBodySchema,
} from './validators/usaha.validator';

type CreateBody = z.infer<typeof createUsahaBodySchema>;
type UpdateBody = z.infer<typeof updateUsahaBodySchema>;

function serialize(u: UsahaListItem | UsahaDetail) {
  const items = 'items' in u ? u.items : undefined;
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    description: u.description,
    category_id: u.categoryId,
    category: u.category,
    kind: u.kind,
    region_id: u.regionId,
    village_id: u.villageId,
    village: u.village,
    address_text: u.addressText,
    lat: u.lat,
    lng: u.lng,
    maps_url: u.mapsUrl,
    phone: u.phone,
    whatsapp: u.whatsapp,
    website: u.website,
    social_url: u.socialUrl,
    cover_url: u.coverUrl,
    publish_status: u.publishStatus,
    operational_status: u.operationalStatus,
    restricted_reason: u.restrictedReason,
    restricted_at: u.restrictedAt ? u.restrictedAt.toISOString() : null,
    manager_id: u.managerId,
    author_id: u.authorId,
    published_at: u.publishedAt ? u.publishedAt.toISOString() : null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
    items: items?.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      price_text: it.priceText,
      image_url: it.imageUrl,
      sort_order: it.sortOrder,
    })),
  };
}

export class UsahaController {
  constructor(
    private readonly createUc: CreateUsahaUseCase,
    private readonly updateUc: UpdateUsahaUseCase,
    private readonly deleteUc: DeleteUsahaUseCase,
    private readonly listUc: ListUsahasUseCase,
    private readonly getBySlugUc: GetUsahaBySlugUseCase,
    private readonly restrictUc: RestrictUsahaUseCase,
    private readonly restoreUc: RestoreUsahaUseCase,
    private readonly listCategoriesUc: ListUsahaCategoriesUseCase,
    private readonly duplicatesUc: FindUsahaDuplicatesUseCase,
  ) {}

  listCategories(c: Context<{ Variables: AppVariables }>, publicOnly: boolean) {
    return this.listCategoriesUc.execute(publicOnly).then((items) =>
      c.json({ success: true as const, data: { items } }),
    );
  }

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listUsahasQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        regionId: query.region_id,
        villageId: query.village_id,
        kind: query.kind,
        operationalStatus: query.operational_status,
        q: query.q,
        publicOnly: true,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serialize),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  getBySlug(c: Context<{ Variables: AppVariables }>, slug: string) {
    return this.getBySlugUc
      .execute(slug, true)
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listUsahasQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        before: query.before,
        categoryId: query.category_id,
        regionId: query.region_id,
        villageId: query.village_id,
        kind: query.kind,
        operationalStatus: query.operational_status,
        q: query.q,
        status: query.status,
      })
      .then((res) =>
        c.json({
          success: true as const,
          data: {
            items: res.items.map(serialize),
            next_cursor: res.nextCursor,
          },
        }),
      );
  }

  create(c: Context<{ Variables: AppVariables }>, body: CreateBody) {
    return this.createUc
      .execute({
        id: body.id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        kind: body.kind,
        regionId: body.region_id,
        villageId: body.village_id,
        addressText: body.address_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        phone: body.phone,
        whatsapp: body.whatsapp,
        website: body.website,
        socialUrl: body.social_url,
        coverUrl: body.cover_url,
        publishStatus: body.publish_status,
        operationalStatus: body.operational_status,
        authorId: c.get('user')?.user_id ?? null,
      })
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  update(c: Context<{ Variables: AppVariables }>, id: string, body: UpdateBody) {
    return this.updateUc
      .execute({
        id,
        slug: body.slug,
        name: body.name,
        description: body.description,
        categoryId: body.category_id,
        kind: body.kind,
        regionId: body.region_id,
        villageId: body.village_id,
        addressText: body.address_text,
        lat: body.lat,
        lng: body.lng,
        mapsUrl: body.maps_url,
        phone: body.phone,
        whatsapp: body.whatsapp,
        website: body.website,
        socialUrl: body.social_url,
        coverUrl: body.cover_url,
        publishStatus: body.publish_status,
        operationalStatus: body.operational_status,
      })
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deleteUc
      .execute(id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  restrict(c: Context<{ Variables: AppVariables }>, id: string, reason: string) {
    return this.restrictUc
      .execute(id, reason)
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  restore(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.restoreUc
      .execute(id)
      .then((usaha) => c.json({ success: true as const, data: serialize(usaha) }));
  }

  duplicates(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.duplicatesUc
      .execute(id)
      .then((items) => c.json({ success: true as const, data: { items } }));
  }
}
