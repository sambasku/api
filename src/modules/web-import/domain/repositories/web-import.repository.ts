import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type { NewWebImport, WebImport, WebImportDetail, WebImportStatus } from '../entities/web-import.entity';

export type ListWebImportsInput = {
  limit: number;
  cursor?: string;
  status?: WebImportStatus;
  q?: string;
};

/** Halaman baris detail dalam satu pengajuan - cursor = row_number terakhir. */
export type ListWebImportDetailsInput = {
  importId: string;
  limit: number;
  before?: number;
};

export type ListWebImportDetailsResult = {
  items: WebImportDetail[];
  nextCursor: number | null;
  hasMore: boolean;
};

export interface WebImportRepository {
  /** Insert header + detail dalam satu transaksi. */
  create(input: NewWebImport): Promise<WebImport>;
  findById(id: string): Promise<WebImport | null>;
  list(input: ListWebImportsInput): Promise<CursorPage<WebImport>>;
  listDetails(input: ListWebImportDetailsInput): Promise<ListWebImportDetailsResult>;
  /** Setujui: status header + semua detail pending -> approved (satu UPDATE per tabel). */
  approve(id: string, actorId: string, note?: string | null): Promise<WebImport | null>;
  /** Tolak: status header rejected + semua detail -> rejected. Note wajib. */
  reject(id: string, actorId: string, note: string): Promise<WebImport | null>;
}
