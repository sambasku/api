import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { WEB_IMPORT_USER_ID } from '@/shared/constants/web-importer';
import { generateId } from '@/shared/utils/ulid';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WebImportRepository } from '../../domain/repositories/web-import.repository';
import type { NewWebImport, WebImport, WebImportDetail, WebImportStatus } from '../../domain/entities/web-import.entity';

const WORD_CLASS_CODES = ['kb', 'kk', 'ks', 'kt', 'kd'] as const;
const MAX_ROWS_PER_SUBMIT = 200;

export type SubmitWebImportInput = {
  officerName: string;
  sourceLabel?: string | null;
  supportName?: string | null;
  supportType?: 'web' | 'book' | 'article' | 'other';
  supportAddress?: string | null;
  supportTitle?: string | null;
  supportDesc?: string | null;
  rows: {
    kata: string;
    terjemahan?: string | null;
    penjelasan_arti?: string | null;
    type?: string | null;
    contoh?: string | null;
    arti_contoh?: string | null;
  }[];
};

export type SubmitWebImportResult = {
  id: string;
  status: WebImportStatus;
  totalRows: number;
  officerName: string;
};

function normalizeType(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase() ?? '';
  return code === '' || WORD_CLASS_CODES.includes(code as any) ? code : null;
}

function validateRows(
  rows: SubmitWebImportInput['rows'],
): { kata: string; terjemahan: string | null; penjelasanArti: string | null; type: string | null; contoh: string | null; artiContoh: string | null; valid: boolean; error?: string }[] {
  const seen = new Map<string, number>();
  return rows.map((row, index) => {
    const kata = row.kata?.trim() ?? '';
    if (!kata) {
      return { kata: '', terjemahan: null, penjelasanArti: null, type: null, contoh: null, artiContoh: null, valid: false, error: 'Kata wajib diisi' };
    }
    const key = kata.toLowerCase() + '|' + (row.terjemahan?.trim() ?? '').toLowerCase() + '|' + (row.penjelasan_arti?.trim() ?? '').toLowerCase();
    const dup = seen.get(key);
    if (dup !== undefined) {
      return { kata: '', terjemahan: null, penjelasanArti: null, type: null, contoh: null, artiContoh: null, valid: false, error: `Duplikat baris ${dup + 1}` };
    }
    seen.set(key, index);
    const type = normalizeType(row.type);
    const terjemahan = row.terjemahan?.trim() ?? null;
    const penjelasanArti = row.penjelasan_arti?.trim() ?? null;
    if (!terjemahan && !penjelasanArti) {
      return { kata, terjemahan, penjelasanArti, type, contoh: row.contoh?.trim() ?? null, artiContoh: row.arti_contoh?.trim() ?? null, valid: false, error: 'Terjemahan atau penjelasan arti wajib diisi' };
    }
    return {
      kata,
      terjemahan,
      penjelasanArti,
      type,
      contoh: row.contoh?.trim() ?? null,
      artiContoh: row.arti_contoh?.trim() ?? null,
      valid: true,
    };
  });
}

export class SubmitWebImportUseCase {
  constructor(
    private readonly repo: WebImportRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: SubmitWebImportInput): Promise<SubmitWebImportResult> {
    if (!input.officerName?.trim() || input.officerName.trim().length < 2) {
      throw new BadRequestError('VALIDATION_ERROR', 'Nama petugas wajib diisi (min 2 karakter)', [
        { field: 'officerName', message: 'Nama petugas minimal 2 karakter' },
      ]);
    }
    if (!input.rows || input.rows.length === 0) {
      throw new BadRequestError('BATCH_EMPTY', 'Minimal satu baris kata harus diisi');
    }
    if (input.rows.length > MAX_ROWS_PER_SUBMIT) {
      throw new BadRequestError(
        'BATCH_TOO_LARGE',
        `Maksimal ${MAX_ROWS_PER_SUBMIT} kata per kiriman`,
      );
    }

    const validated = validateRows(input.rows);
    const invalid = validated.filter((r) => !r.valid);
    if (invalid.length > 0) {
      throw new BadRequestError(
        'BATCH_INVALID_ROWS',
        'Ada baris yang tidak valid',
        invalid.map((r) => ({ field: `rows.${validated.findIndex((v) => v === r)}`, message: r.error ?? 'Tidak valid' })),
      );
    }

    const id = generateId();
    const details: Omit<NewWebImport['details'][number], 'importId'>[] = validated.map((r, i) => ({
      rowNumber: i + 1,
      kata: r.kata,
      terjemahan: r.terjemahan,
      penjelasanArti: r.penjelasanArti,
      type: r.type,
      contoh: r.contoh,
      artiContoh: r.artiContoh,
      status: 'pending' as const,
      adminNote: null,
      outcome: null,
      outcomeMessage: null,
      wordId: null,
    }));

    const newImport: NewWebImport = {
      id,
      submittedBy: WEB_IMPORT_USER_ID,
      officerName: input.officerName.trim(),
      sourceLabel: input.sourceLabel?.trim() ?? null,
      supportName: input.supportName?.trim() ?? null,
      supportType: input.supportType ?? null,
      supportAddress: input.supportAddress?.trim() ?? null,
      supportTitle: input.supportTitle?.trim() ?? null,
      supportDesc: input.supportDesc?.trim() ?? null,
      details,
    };

    const created = await this.repo.create(newImport);

    await this.auditRepo.record({
      userId: WEB_IMPORT_USER_ID,
      action: 'create',
      entityType: 'web_import',
      entityId: created.id,
      newData: {
        officer_name: created.officerName,
        total_rows: created.totalRows,
        status: created.status,
      },
      requestId: null,
    });

    return {
      id: created.id,
      status: created.status,
      totalRows: created.totalRows,
      officerName: created.officerName,
    };
  }
}

export class ListWebImportsUseCase {
  constructor(private readonly repo: WebImportRepository) {}

  async execute(input: {
    limit: number;
    cursor?: string;
    status?: WebImportStatus;
    q?: string;
  }): Promise<{ items: WebImport[]; nextCursor: string | null; hasMore: boolean }> {
    return this.repo.list(input);
  }
}

export class GetWebImportUseCase {
  constructor(private readonly repo: WebImportRepository) {}

  async execute(id: string): Promise<WebImport> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundError('WEB_IMPORT_NOT_FOUND', 'Pengajuan tidak ditemukan');
    return found;
  }
}

export class PreviewWebImportUseCase {
  constructor(private readonly repo: WebImportRepository) {}

  async execute(input: { importId: string; limit: number; before?: number }): Promise<{ items: WebImportDetail[]; nextCursor: number | null; hasMore: boolean }> {
    return this.repo.listDetails(input);
  }
}

export class ApproveWebImportUseCase {
  constructor(
    private readonly repo: WebImportRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: { id: string; actorId: string; note?: string | null }): Promise<WebImport> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('WEB_IMPORT_NOT_FOUND', 'Pengajuan tidak ditemukan');
    if (existing.status !== 'pending_review') {
      throw new ConflictError('WEB_IMPORT_NOT_PENDING', 'Pengajuan sudah direview, tidak bisa di-approve ulang');
    }

    const approved = await this.repo.approve(input.id, input.actorId, input.note ?? null);
    if (!approved) throw new NotFoundError('WEB_IMPORT_NOT_FOUND', 'Pengajuan tidak ditemukan');

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'approve',
      entityType: 'web_import',
      entityId: approved.id,
      oldData: { status: 'pending_review' },
      newData: { status: 'approved', review_note: input.note },
      requestId: null,
    });

    return approved;
  }
}

export class RejectWebImportUseCase {
  constructor(
    private readonly repo: WebImportRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: { id: string; actorId: string; note: string }): Promise<WebImport> {
    if (!input.note?.trim()) {
      throw new BadRequestError('VALIDATION_ERROR', 'Alasan penolakan wajib diisi', [
        { field: 'note', message: 'Catatan penolakan wajib diisi' },
      ]);
    }
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('WEB_IMPORT_NOT_FOUND', 'Pengajuan tidak ditemukan');
    if (existing.status !== 'pending_review') {
      throw new ConflictError('WEB_IMPORT_NOT_PENDING', 'Pengajuan sudah direview, tidak bisa di-reject ulang');
    }

    const rejected = await this.repo.reject(input.id, input.actorId, input.note.trim());
    if (!rejected) throw new NotFoundError('WEB_IMPORT_NOT_FOUND', 'Pengajuan tidak ditemukan');

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'reject',
      entityType: 'web_import',
      entityId: rejected.id,
      oldData: { status: 'pending_review' },
      newData: { status: 'rejected', review_note: input.note },
      requestId: null,
    });

    return rejected;
  }
}