import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { WebImport, WebImportDetail } from '../../domain/entities/web-import.entity';
import type {
  SubmitWebImportUseCase,
  ListWebImportsUseCase,
  GetWebImportUseCase,
  PreviewWebImportUseCase,
  ApproveWebImportUseCase,
  RejectWebImportUseCase,
} from '../../application/use-cases/web-import.use-cases';
import type { z } from 'zod';
import type {
  submitWebImportBodySchema,
  listWebImportsQuerySchema,
  webImportIdParamsSchema,
  previewWebImportQuerySchema,
  approveWebImportBodySchema,
  rejectWebImportBodySchema,
  submitWebImportResponseSchema,
  getWebImportResponseSchema,
  listWebImportsResponseSchema,
  previewWebImportResponseSchema,
} from './validators/web-import.validator';

function serializeWebImport(r: WebImport) {
  return {
    id: r.id,
    submitted_by: r.submittedBy,
    officer_name: r.officerName,
    source_label: r.sourceLabel,
    support_name: r.supportName,
    support_type: r.supportType,
    support_address: r.supportAddress,
    support_title: r.supportTitle,
    support_desc: r.supportDesc,
    status: r.status,
    total_rows: r.totalRows,
    reviewed_by: r.reviewedBy,
    reviewed_by_name: r.reviewedByName,
    reviewed_at: r.reviewedAt ? Math.floor(r.reviewedAt.getTime() / 1000) : null,
    review_note: r.reviewNote,
    error_message: r.errorMessage,
    created_at: Math.floor(r.createdAt.getTime() / 1000),
    updated_at: Math.floor(r.updatedAt.getTime() / 1000),
  };
}

function serializeWebImportDetail(r: WebImportDetail) {
  return {
    id: r.id,
    import_id: r.importId,
    row_number: r.rowNumber,
    kata: r.kata,
    terjemahan: r.terjemahan,
    penjelasan_arti: r.penjelasanArti,
    type: r.type,
    contoh: r.contoh,
    arti_contoh: r.artiContoh,
    status: r.status,
    admin_note: r.adminNote,
    outcome: r.outcome,
    outcome_message: r.outcomeMessage,
    word_id: r.wordId,
    created_at: Math.floor(r.createdAt.getTime() / 1000),
  };
}

export class WebImportController {
  constructor(
    private readonly submitUc: SubmitWebImportUseCase,
    private readonly listUc: ListWebImportsUseCase,
    private readonly getUc: GetWebImportUseCase,
    private readonly previewUc: PreviewWebImportUseCase,
    private readonly approveUc: ApproveWebImportUseCase,
    private readonly rejectUc: RejectWebImportUseCase,
  ) {}

  submit(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof submitWebImportBodySchema>,
  ) {
    return this.submitUc
      .execute(body)
      .then((r) =>
        c.json(
          {
            success: true,
            data: {
              id: r.id,
              status: r.status,
              total_rows: r.totalRows,
              officer_name: r.officerName,
              created_at: Math.floor(r.createdAt.getTime() / 1000),
            },
          } satisfies z.infer<typeof submitWebImportResponseSchema>,
        ),
      )
      .catch((err) => c.json({ success: false, error: err.message }, 400));
  }

  list(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listWebImportsQuerySchema>,
  ) {
    return this.listUc
      .execute({
        limit: query.limit,
        cursor: query.cursor,
        status: query.status,
        q: query.q,
      })
      .then((r) =>
        c.json(
          {
            success: true,
            data: {
              items: r.items.map(serializeWebImport),
              next_cursor: r.nextCursor,
            },
          } satisfies z.infer<typeof listWebImportsResponseSchema>,
        ),
      );
  }

  getById(
    c: Context<{ Variables: AppVariables }>,
    params: z.infer<typeof webImportIdParamsSchema>,
  ) {
    return this.getUc
      .execute(params.id)
      .then((r) =>
        c.json(
          {
            success: true,
            data: serializeWebImport(r),
          } satisfies z.infer<typeof getWebImportResponseSchema>,
        ),
      )
      .catch((err) => c.json({ success: false, error: err.message }, 404));
  }

  preview(
    c: Context<{ Variables: AppVariables }>,
    params: z.infer<typeof webImportIdParamsSchema>,
    query: z.infer<typeof previewWebImportQuerySchema>,
  ) {
    return this.previewUc
      .execute({
        importId: params.id,
        limit: query.limit,
        before: query.before,
      })
      .then((r) =>
        c.json(
          {
            success: true,
            data: {
              items: r.items.map(serializeWebImportDetail),
              next_cursor: r.nextCursor,
              has_more: r.hasMore,
            },
          } satisfies z.infer<typeof previewWebImportResponseSchema>,
        ),
      );
  }

  approve(
    c: Context<{ Variables: AppVariables }>,
    params: z.infer<typeof webImportIdParamsSchema>,
    body: z.infer<typeof approveWebImportBodySchema>,
  ) {
    return this.approveUc
      .execute(params.id, c.get('user')!.user_id, body.note)
      .then((r) =>
        c.json(
          {
            success: true,
            data: serializeWebImport(r),
          } satisfies z.infer<typeof getWebImportResponseSchema>,
        ),
      )
      .catch((err) => c.json({ success: false, error: err.message }, 404));
  }

  reject(
    c: Context<{ Variables: AppVariables }>,
    params: z.infer<typeof webImportIdParamsSchema>,
    body: z.infer<typeof rejectWebImportBodySchema>,
  ) {
    return this.rejectUc
      .execute(params.id, c.get('user')!.user_id, body.note)
      .then((r) =>
        c.json(
          {
            success: true,
            data: serializeWebImport(r),
          } satisfies z.infer<typeof getWebImportResponseSchema>,
        ),
      )
      .catch((err) => c.json({ success: false, error: err.message }, 404));
  }
}