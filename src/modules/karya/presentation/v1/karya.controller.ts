import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type {
  AccessLink,
  Karya,
  KaryaContribution,
  KaryaCredit,
  KaryaExcerpt,
  KaryaFields,
  KaryaLemmaLink,
  KaryaRelatedRef,
  SambasConnection,
} from '../../domain/karya';
import type { ResolvedKaryaRelatedWire } from '../../application/resolve-karya-related';
import { toKaryaLemmaLinkWire } from './karya-lemma-link.controller';
import { isExcerptContributionPayload } from '../../domain/karya';
import type { KaryaUseCases } from '../../application/karya.use-cases';
import type {
  contributionListQuerySchema,
  karyaFieldsSchema,
  listKaryaQuerySchema,
  rejectKaryaSchema,
  revisionNoteSchema,
  submitKaryaContributionBodySchema,
} from './validators/karya.validator';
import { newKaryaPayloadSchema } from './validators/karya.validator';

function requireUserId(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user.user_id;
}

function fieldsFrom(body: z.infer<typeof karyaFieldsSchema>): KaryaFields {
  return {
    title: body.title,
    year: body.year,
    kind: body.kind,
    language: body.language ?? null,
    description: body.description ?? null,
    coverUrl: body.cover_url ?? null,
    sambasConnections: body.sambas_connections.map((c) => ({
      type: c.type,
      note: c.note,
    })),
    accessLinks: (body.access_links ?? []).map((l) => ({
      kind: l.kind,
      label: l.label,
      url: l.url,
      isPrimary: l.is_primary === true,
    })),
    credits: body.credits.map((c, i) => ({
      role: c.role,
      nameText: c.name_text,
      kreatorId: c.kreator_id ?? null,
      sortOrder: c.sort_order ?? i,
    })),
    musicReleaseType: body.music_release_type ?? null,
    musicDurationMs: body.music_duration_ms ?? null,
    musicIsCover: body.music_is_cover === true,
    filmType: body.film_type ?? null,
    filmRuntimeMin: body.film_runtime_min ?? null,
    related: (body.related ?? []).map((r) => ({
      kind: r.kind,
      slug: r.slug,
      id: r.id,
    })),
  };
}

function sambasWire(rows: SambasConnection[]) {
  return rows.map((r) => ({ type: r.type, note: r.note }));
}

function accessWire(rows: AccessLink[]) {
  return rows.map((r) => ({
    kind: r.kind,
    label: r.label,
    url: r.url,
    is_primary: r.isPrimary === true,
  }));
}

function creditWire(rows: KaryaCredit[]) {
  return rows.map((r) => ({
    id: r.id ?? null,
    role: r.role,
    name_text: r.nameText,
    kreator_id: r.kreatorId,
    kreator_slug: r.kreatorSlug ?? null,
    sort_order: r.sortOrder,
  }));
}

function excerptWire(rows: KaryaExcerpt[]) {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    text: r.text,
    language: r.language,
    start_label: r.startLabel,
    end_label: r.endLabel,
    rights_status: r.rightsStatus,
    source_url: r.sourceUrl,
    lemma_links: (r.lemmaLinks ?? []).map((link: KaryaLemmaLink) =>
      toKaryaLemmaLinkWire(link),
    ),
  }));
}

function relatedRefsWire(rows: KaryaRelatedRef[]) {
  return rows.map((r) => ({
    kind: r.kind,
    slug: r.slug ?? null,
    id: r.id ?? null,
  }));
}

function relatedResolvedWire(rows: ResolvedKaryaRelatedWire[]) {
  return rows.map((r) => ({
    kind: r.kind,
    slug: r.slug,
    id: r.id,
    title: r.title,
    href_kind: r.href_kind,
  }));
}

function toKaryaWire(
  row: Karya & { authorName?: string | null },
  admin: boolean,
  options?: { relatedResolved?: ResolvedKaryaRelatedWire[] },
) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    year: row.year,
    language: row.language,
    description: row.description,
    cover_url: row.coverUrl,
    sambas_connections: sambasWire(row.sambasConnections),
    access_links: accessWire(row.accessLinks),
    credits: creditWire(row.credits),
    music_release_type: row.musicReleaseType,
    music_duration_ms: row.musicDurationMs,
    music_is_cover: row.musicIsCover,
    film_type: row.filmType,
    film_runtime_min: row.filmRuntimeMin,
    excerpts: excerptWire(row.excerpts ?? []),
    ...(options?.relatedResolved
      ? { related: relatedResolvedWire(options.relatedResolved) }
      : {}),
    ...(admin ? { related_refs: relatedRefsWire(row.related) } : {}),
    updated_at: (row.updatedAt ?? row.createdAt).toISOString(),
    author: row.author
      ? {
          id: row.author.id,
          username: row.author.username,
          display_name: row.author.displayName,
        }
      : null,
    ...(admin
      ? {
          publish_status: row.publishStatus,
          author_id: row.authorId,
          author_username: row.authorName ?? null,
          created_at: row.createdAt.toISOString(),
        }
      : {}),
  };
}

function toContributionWire(row: KaryaContribution) {
  let payload: Record<string, unknown>;
  if (isExcerptContributionPayload(row.payload)) {
    const ex = row.payload.excerpt;
    payload = {
      kind: ex.kind,
      text: ex.text,
      language: ex.language,
      start_label: ex.startLabel,
      end_label: ex.endLabel,
      rights_status: ex.rightsStatus,
      rights_note: ex.rightsNote,
      source_url: ex.sourceUrl,
    };
  } else {
    payload = {
      title: row.payload.title,
      year: row.payload.year,
      kind: row.payload.kind,
      language: row.payload.language,
      description: row.payload.description,
      cover_url: row.payload.coverUrl,
      sambas_connections: sambasWire(row.payload.sambasConnections),
      access_links: accessWire(row.payload.accessLinks),
      credits: creditWire(row.payload.credits),
      music_release_type: row.payload.musicReleaseType,
      music_is_cover: row.payload.musicIsCover,
      film_type: row.payload.filmType,
      film_runtime_min: row.payload.filmRuntimeMin,
      related: relatedRefsWire(row.payload.related ?? []),
    };
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    username: row.username,
    karya_id: row.karyaId,
    payload,
    revision_note: row.revisionNote,
    reject_reason_code: row.rejectReasonCode,
    created_at: row.createdAt.toISOString(),
  };
}

export class KaryaController {
  constructor(private readonly uc: KaryaUseCases) {}

  async listPublic(c: Context, query: z.infer<typeof listKaryaQuerySchema>) {
    const items = await this.uc.listPublic({
      kind: query.kind,
      year: query.year,
      q: query.q,
      language: query.language,
      sambasType: query.sambas_type,
    });
    return c.json({
      success: true as const,
      data: { items: items.map((row) => toKaryaWire(row, false)) },
    });
  }

  async getPublic(c: Context, slug: string) {
    const row = await this.uc.getPublished(slug);
    const related = await this.uc.resolveRelatedForKarya(row);
    return c.json({
      success: true as const,
      data: toKaryaWire(row, false, { relatedResolved: related }),
    });
  }

  async adminList(c: Context) {
    const items = await this.uc.listManage();
    return c.json({
      success: true as const,
      data: { items: items.map((row) => toKaryaWire(row, true)) },
    });
  }

  async adminCreate(c: Context, body: z.infer<typeof karyaFieldsSchema>) {
    const row = await this.uc.adminCreate(fieldsFrom(body), requireUserId(c));
    return c.json({ success: true as const, data: toKaryaWire(row, true) }, 201);
  }

  async adminUpdate(
    c: Context,
    id: string,
    body: z.infer<typeof karyaFieldsSchema>,
  ) {
    const row = await this.uc.adminUpdate(id, fieldsFrom(body));
    return c.json({ success: true as const, data: toKaryaWire(row, true) });
  }

  async adminPublish(c: Context, id: string, published: boolean) {
    await this.uc.adminSetPublish(id, published);
    return c.json({ success: true as const, data: null });
  }

  async submit(c: Context, body: z.infer<typeof submitKaryaContributionBodySchema>) {
    const row = await this.uc.submit(
      requireUserId(c),
      body.kind,
      body.payload,
      body.karya_id,
    );
    return c.json({ success: true as const, data: toContributionWire(row) }, 201);
  }

  async mine(c: Context) {
    const items = await this.uc.listMine(requireUserId(c));
    return c.json({
      success: true as const,
      data: { items: items.map(toContributionWire) },
    });
  }

  async queue(c: Context, query: z.infer<typeof contributionListQuerySchema>) {
    const items = await this.uc.listAdmin(query.status ?? 'pending');
    return c.json({
      success: true as const,
      data: { items: items.map(toContributionWire) },
    });
  }

  async resubmit(c: Context, id: string, body: unknown) {
    const row = await this.uc.resubmit(id, requireUserId(c), body);
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

  async reject(c: Context, id: string, body: z.infer<typeof rejectKaryaSchema>) {
    await this.uc.reject(id, body.reason_code, body.reason_text);
    return c.json({ success: true as const, data: null });
  }

  async revise(c: Context, id: string, body: z.infer<typeof revisionNoteSchema>) {
    await this.uc.requestRevision(id, body.note);
    return c.json({ success: true as const, data: null });
  }
}

/** Helper for routes that accept flat admin body. */
export function parseAdminKaryaBody(body: unknown) {
  return newKaryaPayloadSchema.parse(body);
}
