import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { Layanan, LayananContribution, LayananFields } from '../../domain/layanan';
import type { LayananUseCases } from '../../application/layanan.use-cases';
import type { LayananFieldsBody, SubmitLayananBody } from './layanan.validator';

function requireUserId(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user.user_id;
}

function fieldsOf(body: LayananFieldsBody): LayananFields {
  return {
    category: body.category,
    name: body.name,
    phone: body.phone,
    whatsapp: body.whatsapp ?? null,
    addressText: body.address_text ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    mapsUrl: body.maps_url ?? null,
    regionId: body.region_id,
    villageId: body.village_id ?? null,
    note: body.note ?? null,
  };
}

export function toLayananWire(row: Layanan, opts?: { admin?: boolean }) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
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
    ...(opts?.admin
      ? {
          publish_status: row.publishStatus,
          author_id: row.authorId,
          created_at: row.createdAt.toISOString(),
        }
      : {}),
  };
}

export function toContributionWire(row: LayananContribution) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    user_id: row.userId,
    username: row.username,
    layanan_id: row.layananId,
    result_layanan_id: row.resultLayananId,
    revision_note: row.revisionNote,
    reject_reason_code: row.rejectReasonCode,
    reject_reason_text: row.rejectReasonText,
    payload: {
      category: row.payload.category,
      name: row.payload.name,
      phone: row.payload.phone,
      whatsapp: row.payload.whatsapp,
      address_text: row.payload.addressText,
      lat: row.payload.lat,
      lng: row.payload.lng,
      maps_url: row.payload.mapsUrl,
      region_id: row.payload.regionId,
      village_id: row.payload.villageId,
      note: row.payload.note,
    },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export class LayananController {
  constructor(private readonly uc: LayananUseCases) {}

  async listPublic(
    c: Context,
    query: { region_id?: string; category?: 'ambulance' | 'fire' },
  ) {
    const items = await this.uc.listPublic({
      regionRef: query.region_id,
      category: query.category,
    });
    return c.json({ success: true as const, data: { items: items.map((row) => toLayananWire(row)) } });
  }

  async getPublic(c: Context, slug: string) {
    const row = await this.uc.getPublished(slug);
    return c.json({ success: true as const, data: toLayananWire(row) });
  }

  async adminCreate(c: Context<{ Variables: AppVariables }>, body: LayananFieldsBody) {
    const row = await this.uc.adminCreate(requireUserId(c), fieldsOf(body));
    return c.json({ success: true as const, data: toLayananWire(row, { admin: true }) }, 201);
  }

  async adminUpdate(c: Context, id: string, body: LayananFieldsBody) {
    const row = await this.uc.adminUpdate(id, fieldsOf(body));
    return c.json({ success: true as const, data: toLayananWire(row, { admin: true }) });
  }

  async adminPublish(c: Context, id: string, publish: boolean) {
    const row = await this.uc.adminSetPublish(id, publish ? 'published' : 'unpublished');
    return c.json({ success: true as const, data: toLayananWire(row, { admin: true }) });
  }

  async adminList(c: Context, regionId?: string) {
    const rows = await this.uc.listManage(regionId);
    return c.json({
      success: true as const,
      data: { items: rows.map((row) => toLayananWire(row, { admin: true })) },
    });
  }

  async submit(c: Context<{ Variables: AppVariables }>, body: SubmitLayananBody) {
    const row = await this.uc.submit(
      requireUserId(c),
      body.kind,
      fieldsOf(body),
      body.layanan_id,
    );
    return c.json({ success: true as const, data: toContributionWire(row) }, 201);
  }

  async mine(c: Context<{ Variables: AppVariables }>) {
    const items = await this.uc.listMine(requireUserId(c));
    return c.json({
      success: true as const,
      data: { items: items.map(toContributionWire) },
    });
  }

  async resubmit(c: Context<{ Variables: AppVariables }>, id: string, body: LayananFieldsBody) {
    const row = await this.uc.resubmit(requireUserId(c), id, fieldsOf(body));
    return c.json({ success: true as const, data: toContributionWire(row) });
  }

  async cancel(c: Context<{ Variables: AppVariables }>, id: string) {
    await this.uc.cancel(requireUserId(c), id);
    return c.json({ success: true as const, data: null });
  }

  async queue(
    c: Context,
    status?: 'pending' | 'needs_revision' | 'approved' | 'rejected',
  ) {
    const items = await this.uc.listAdmin(status ?? 'pending');
    return c.json({
      success: true as const,
      data: { items: items.map(toContributionWire) },
    });
  }

  async approve(c: Context, id: string) {
    await this.uc.approve(id);
    return c.json({ success: true as const, data: null });
  }

  async reject(c: Context, id: string, reasonCode: string, reasonText?: string) {
    await this.uc.reject(id, reasonCode, reasonText);
    return c.json({ success: true as const, data: null });
  }

  async revise(c: Context, id: string, note: string) {
    await this.uc.requestRevision(id, note);
    return c.json({ success: true as const, data: null });
  }
}
