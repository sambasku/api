import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { Layanan, LayananContribution, LayananFields, LayananPhone } from '../../domain/layanan';
import type { LayananUseCases } from '../../application/layanan.use-cases';
import type {
  contributionListQuerySchema,
  layananFieldsSchema,
  listLayananQuerySchema,
  rejectLayananSchema,
  revisionNoteSchema,
  submitLayananSchema,
} from './layanan.validator';

function requireUserId(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user.user_id;
}

function phonesFrom(
  body: z.infer<typeof layananFieldsSchema>['phones'],
): LayananPhone[] {
  return body.map((row) => ({
    phone: row.phone,
    note: row.note ?? null,
    whatsapp: row.whatsapp ?? null,
  }));
}

function fieldsFrom(body: z.infer<typeof layananFieldsSchema>): LayananFields {
  return {
    category: body.category,
    name: body.name,
    phones: phonesFrom(body.phones),
    logoUrl: body.logo_url ?? null,
    addressText: body.address_text ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    mapsUrl: body.maps_url ?? null,
    regionId: body.region_id,
    villageId: body.village_id ?? null,
    note: body.note ?? null,
  };
}

function phoneWire(row: LayananPhone) {
  return {
    phone: row.phone,
    note: row.note,
    whatsapp: row.whatsapp,
  };
}

function toLayananWire(row: Layanan, admin: boolean) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    name: row.name,
    phones: row.phones.map(phoneWire),
    logo_url: row.logoUrl,
    address_text: row.addressText,
    lat: row.lat,
    lng: row.lng,
    maps_url: row.mapsUrl,
    region_id: row.regionId,
    region_name: row.regionName,
    region_slug: row.regionSlug,
    village_id: row.villageId,
    village_name: row.villageName,
    note: row.note,
    updated_at: (row.updatedAt ?? row.createdAt).toISOString(),
    ...(admin
      ? {
          publish_status: row.publishStatus,
          author_id: row.authorId,
          created_at: row.createdAt.toISOString(),
        }
      : {}),
  };
}

function toContributionWire(row: LayananContribution) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    username: row.username,
    layanan_id: row.layananId,
    payload: {
      category: row.payload.category,
      name: row.payload.name,
      phones: row.payload.phones.map(phoneWire),
      logo_url: row.payload.logoUrl,
      address_text: row.payload.addressText,
      lat: row.payload.lat,
      lng: row.payload.lng,
      maps_url: row.payload.mapsUrl,
      region_id: row.payload.regionId,
      village_id: row.payload.villageId,
      note: row.payload.note,
    },
    revision_note: row.revisionNote,
    reject_reason_code: row.rejectReasonCode,
    created_at: row.createdAt.toISOString(),
  };
}

export class LayananController {
  constructor(private readonly uc: LayananUseCases) {}

  async listPublic(c: Context, query: z.infer<typeof listLayananQuerySchema>) {
    const items = await this.uc.listPublic({
      regionRef: query.region_id,
      category: query.category,
    });
    return c.json({ success: true as const, data: { items: items.map((row) => toLayananWire(row, false)) } });
  }

  async getPublic(c: Context, slug: string) {
    const row = await this.uc.getPublished(slug);
    return c.json({ success: true as const, data: toLayananWire(row, false) });
  }

  async adminList(c: Context) {
    const items = await this.uc.listManage();
    return c.json({ success: true as const, data: { items: items.map((row) => toLayananWire(row, true)) } });
  }

  async adminCreate(c: Context, body: z.infer<typeof layananFieldsSchema>) {
    const row = await this.uc.adminCreate(fieldsFrom(body), requireUserId(c));
    return c.json({ success: true as const, data: toLayananWire(row, true) }, 201);
  }

  async adminUpdate(c: Context, id: string, body: z.infer<typeof layananFieldsSchema>) {
    const row = await this.uc.adminUpdate(id, fieldsFrom(body));
    return c.json({ success: true as const, data: toLayananWire(row, true) });
  }

  async adminPublish(c: Context, id: string, published: boolean) {
    await this.uc.adminSetPublish(id, published);
    return c.json({ success: true as const, data: null });
  }

  async submit(c: Context, body: z.infer<typeof submitLayananSchema>) {
    const row = await this.uc.submit(
      requireUserId(c),
      fieldsFrom(body),
      body.kind,
      body.layanan_id,
    );
    return c.json({ success: true as const, data: toContributionWire(row) }, 201);
  }

  async mine(c: Context) {
    const items = await this.uc.listMine(requireUserId(c));
    return c.json({ success: true as const, data: { items: items.map(toContributionWire) } });
  }

  async queue(c: Context, query: z.infer<typeof contributionListQuerySchema>) {
    const items = await this.uc.listAdmin(query.status ?? 'pending');
    return c.json({ success: true as const, data: { items: items.map(toContributionWire) } });
  }

  async resubmit(c: Context, id: string, body: z.infer<typeof layananFieldsSchema>) {
    const row = await this.uc.resubmit(id, requireUserId(c), fieldsFrom(body));
    return c.json({ success: true as const, data: toContributionWire(row) });
  }

  async cancel(c: Context, id: string) {
    await this.uc.cancel(id, requireUserId(c));
    return c.json({ success: true as const, data: null });
  }

  async approve(c: Context, id: string) {
    await this.uc.approve(id);
    return c.json({ success: true as const, data: null });
  }

  async reject(c: Context, id: string, body: z.infer<typeof rejectLayananSchema>) {
    await this.uc.reject(id, body.reason_code, body.reason_text);
    return c.json({ success: true as const, data: null });
  }

  async revise(c: Context, id: string, body: z.infer<typeof revisionNoteSchema>) {
    await this.uc.requestRevision(id, body.note);
    return c.json({ success: true as const, data: null });
  }
}
