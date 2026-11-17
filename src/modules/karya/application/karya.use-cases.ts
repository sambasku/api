import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type {
  Karya,
  KaryaContributionPayload,
  KaryaExcerptFields,
  KaryaFields,
} from '../domain/karya';
import { isExcerptContributionPayload, slugifyKarya } from '../domain/karya';
import type { KaryaRepositoryImpl } from '../infrastructure/karya.repository.impl';
import { ResolveKaryaRelated } from './resolve-karya-related';
import type { SambasConnectionType } from '../domain/karya';
import {
  assertExcerptRights,
  excerptPayloadSchema,
  newKaryaPayloadSchema,
} from '../presentation/v1/validators/karya.validator';
import type { z } from 'zod';

const PENDING_CAP = 10;

type NewKaryaBody = z.infer<typeof newKaryaPayloadSchema>;
type ExcerptBody = z.infer<typeof excerptPayloadSchema>;

export class KaryaUseCases {
  constructor(
    private readonly repo: KaryaRepositoryImpl,
    private readonly activity: RecordActivityEventUseCase,
    private readonly relatedResolver: ResolveKaryaRelated,
  ) {}

  listPublic(input: {
    kind?: Karya['kind'];
    year?: number;
    q?: string;
    language?: string;
    sambasType?: SambasConnectionType;
  }) {
    return this.repo.listPublic(input);
  }

  listManage() {
    return this.repo.listManage();
  }

  async getPublished(slug: string): Promise<Karya> {
    const row = await this.repo.findPublishedBySlug(slug);
    if (!row) throw new NotFoundError('KARYA_NOT_FOUND', 'Karya tidak ditemukan');
    return row;
  }

  async resolveRelatedForKarya(row: Karya) {
    return this.relatedResolver.resolve(row.related);
  }

  async adminCreate(fields: KaryaFields, authorId: string): Promise<Karya> {
    const normalized = this.normalizeFieldsFromDomain(fields);
    const slug = await this.uniqueSlug(normalized.title);
    const row = await this.repo.insert({ ...normalized, slug, authorId });
    await this.emitPublished(row);
    return row;
  }

  async adminUpdate(id: string, fields: KaryaFields): Promise<Karya> {
    await this.mustKarya(id);
    const normalized = this.normalizeFieldsFromDomain(fields);
    await this.repo.update(id, normalized);
    return (await this.repo.findById(id))!;
  }

  async adminSetPublish(id: string, published: boolean): Promise<void> {
    await this.mustKarya(id);
    await this.repo.updatePublishStatus(id, published ? 'published' : 'archived');
  }

  async submit(
    userId: string,
    kind: 'new' | 'edit' | 'excerpt',
    payload: unknown,
    karyaId?: string | null,
  ) {
    if ((await this.repo.countOpenByUser(userId)) >= PENDING_CAP) {
      throw new ConflictError('PENDING_CAP', 'Kamu masih punya 10 usulan yang belum selesai');
    }
    let stored: KaryaContributionPayload;
    if (kind === 'excerpt') {
      if (!karyaId) {
        throw new ValidationError([
          { field: 'karya_id', message: 'Usulan cuplikan butuh karya yang dituju' },
        ]);
      }
      await this.mustKarya(karyaId);
      const parsed = excerptPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({
            field: i.path.join('.') || 'payload',
            message: i.message,
          })),
        );
      }
      stored = { kind: 'excerpt', excerpt: this.excerptFromBody(parsed.data) };
    } else {
      const parsed = newKaryaPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({
            field: i.path.join('.') || 'payload',
            message: i.message,
          })),
        );
      }
      if (kind === 'edit') {
        if (!karyaId) {
          throw new ValidationError([
            { field: 'karya_id', message: 'Usulan perbaikan butuh karya yang dituju' },
          ]);
        }
        await this.mustKarya(karyaId);
      }
      stored = this.fieldsFromBody(parsed.data);
    }
    const id = await this.repo.insertContribution({
      kind,
      userId,
      karyaId: kind === 'new' ? null : karyaId!,
      payload: stored,
    });
    return (await this.repo.findContribution(id))!;
  }

  listMine(userId: string) {
    return this.repo.listContributions({ userId });
  }

  listAdmin(status?: 'pending' | 'needs_revision' | 'approved' | 'rejected') {
    return this.repo.listContributions({ status });
  }

  async resubmit(id: string, userId: string, body: unknown) {
    const row = await this.mustOwnOpen(id, userId);
    if (row.status !== 'needs_revision') {
      throw new ConflictError('NOT_REVISABLE', 'Usulan ini tidak sedang menunggu perbaikan');
    }
    let stored: KaryaContributionPayload;
    if (row.kind === 'excerpt') {
      const parsed = excerptPayloadSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({
            field: i.path.join('.') || 'payload',
            message: i.message,
          })),
        );
      }
      stored = { kind: 'excerpt', excerpt: this.excerptFromBody(parsed.data) };
    } else {
      const parsed = newKaryaPayloadSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({
            field: i.path.join('.') || 'payload',
            message: i.message,
          })),
        );
      }
      stored = this.fieldsFromBody(parsed.data);
    }
    await this.repo.updateContribution(id, {
      payload: stored,
      status: 'pending',
      revisionNote: null,
    });
    return (await this.repo.findContribution(id))!;
  }

  async cancel(id: string, userId: string): Promise<void> {
    await this.mustOwnOpen(id, userId);
    await this.repo.deleteContribution(id);
  }

  async approve(id: string): Promise<void> {
    const row = await this.mustPending(id);
    if (row.kind === 'excerpt') {
      if (!isExcerptContributionPayload(row.payload)) {
        throw new ConflictError('INVALID_PAYLOAD', 'Payload usulan cuplikan tidak valid');
      }
      if (!row.karyaId) throw new NotFoundError('KARYA_NOT_FOUND', 'Karya tidak ditemukan');
      await this.mustKarya(row.karyaId);
      const excerptId = await this.repo.insertExcerpt(
        row.karyaId,
        row.payload.excerpt,
        row.userId,
      );
      await this.repo.updateContribution(id, {
        status: 'approved',
        resultExcerptId: excerptId,
      });
      return;
    }
  if (row.kind === 'edit') {
    if (!row.karyaId) throw new NotFoundError('KARYA_NOT_FOUND', 'Karya tidak ditemukan');
    if (isExcerptContributionPayload(row.payload)) {
      throw new ConflictError('INVALID_PAYLOAD', 'Payload usulan edit tidak valid');
    }
    await this.mustKarya(row.karyaId);
    await this.repo.update(row.karyaId, row.payload);
    await this.repo.updateContribution(id, {
      status: 'approved',
      resultKaryaId: row.karyaId,
    });
    return;
  }
    if (isExcerptContributionPayload(row.payload)) {
      throw new ConflictError('INVALID_PAYLOAD', 'Payload usulan karya baru tidak valid');
    }
    const slug = await this.uniqueSlug(row.payload.title);
    const created = await this.repo.insert({
      ...row.payload,
      slug,
      authorId: row.userId,
    });
    await this.repo.updateContribution(id, {
      status: 'approved',
      resultKaryaId: created.id,
    });
    await this.emitPublished(created);
  }

  async reject(id: string, reasonCode: string, reasonText?: string | null) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, {
      status: 'rejected',
      rejectReasonCode: reasonCode,
      rejectReasonText: reasonText ?? null,
    });
  }

  async requestRevision(id: string, note: string) {
    await this.mustPending(id);
    await this.repo.updateContribution(id, { status: 'needs_revision', revisionNote: note });
  }

  private fieldsFromBody(body: NewKaryaBody): KaryaFields {
    return {
      title: body.title.trim(),
      year: body.year,
      kind: body.kind,
      language: body.language?.trim() || null,
      description: body.description?.trim() || null,
      coverUrl: body.cover_url?.trim() || null,
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

  private excerptFromBody(body: ExcerptBody): KaryaExcerptFields {
    const gate = assertExcerptRights({
      text: body.text,
      rightsStatus: body.rights_status,
      rightsNote: body.rights_note,
    });
    if (!gate.ok) {
      throw new ValidationError([{ field: 'text', message: gate.message }]);
    }
    return {
      kind: body.kind,
      text: body.text.trim(),
      language: body.language?.trim() || null,
      startLabel: body.start_label?.trim() || null,
      endLabel: body.end_label?.trim() || null,
      rightsStatus: body.rights_status,
      rightsNote: body.rights_note?.trim() || null,
      sourceUrl: body.source_url?.trim() || null,
    };
  }

  private normalizeFieldsFromDomain(fields: KaryaFields): KaryaFields {
    let coverUrl = fields.coverUrl?.trim() || null;
    if (coverUrl) {
      try {
        const parsed = new URL(coverUrl);
        if (parsed.protocol !== 'https:') {
          throw new ValidationError([
            { field: 'cover_url', message: 'Cover harus memakai tautan https' },
          ]);
        }
        coverUrl = parsed.toString();
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError([{ field: 'cover_url', message: 'Tautan cover tidak valid' }]);
      }
    }
    return {
      ...fields,
      title: fields.title.trim(),
      language: fields.language?.trim() || null,
      description: fields.description?.trim() || null,
      coverUrl,
      related: (fields.related ?? []).map((r) => ({
        kind: r.kind,
        ...(r.slug ? { slug: r.slug.trim() } : {}),
        ...(r.id ? { id: r.id.trim() } : {}),
      })),
      credits: fields.credits.map((c, i) => ({
        ...c,
        role: c.role.trim(),
        nameText: c.nameText.trim(),
        sortOrder: c.sortOrder ?? i,
      })),
    };
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugifyKarya(title);
    const candidates = [base];
    for (let i = 2; i <= 20; i++) candidates.push(`${base}-${i}`);
    const taken = await this.repo.existingSlugs(candidates);
    const free = candidates.find((c) => !taken.has(c));
    return free ?? `${base}-${Date.now()}`;
  }

  private async emitPublished(row: Karya): Promise<void> {
    await this.activity.safe({
      kind: 'karya_published',
      actorId: row.authorId,
      targetId: row.id,
      payload: `Menambahkan karya · "${row.title}"`,
      dedupeKey: `karya_published:${row.id}`,
    });
  }

  private async mustKarya(id: string): Promise<Karya> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError('KARYA_NOT_FOUND', 'Karya tidak ditemukan');
    return row;
  }

  private async mustPending(id: string) {
    const row = await this.repo.findContribution(id);
    if (!row) throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') {
      throw new ConflictError('NOT_PENDING', 'Usulan ini sudah ditinjau');
    }
    return row;
  }

  private async mustOwnOpen(id: string, userId: string) {
    const row = await this.repo.findContribution(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Usulan tidak ditemukan');
    }
    if (row.status !== 'pending' && row.status !== 'needs_revision') {
      throw new ConflictError('NOT_OPEN', 'Usulan ini sudah ditutup');
    }
    return row;
  }
}