import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CategorySuggestion } from '../../domain/entities/category-suggestion.entity';
import type { CategorySuggestionRepository } from '../../domain/repositories/category-suggestion.repository';
import type { CategoryRepository } from '@/modules/category/domain/repositories/category.repository';

export interface ReviewCategorySuggestionCommand {
  suggestionId: string;
  reviewerId: string;
  requestId?: string | null;
}

export interface RejectCategorySuggestionCommand extends ReviewCategorySuggestionCommand {
  reason: string;
}

// Approve = usulan jadi master `categories` + status approved (api#50).
// Unique index master yang menanggung race (sudah ada dari jalur lain) -
// usulan tetap dianggap approved: kategorinya memang ada.
export class ApproveCategorySuggestionUseCase {
  constructor(
    private readonly suggestionRepo: CategorySuggestionRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: ReviewCategorySuggestionCommand): Promise<CategorySuggestion> {
    const suggestion = await this.suggestionRepo.findById(cmd.suggestionId);
    if (!suggestion) {
      throw new NotFoundError('CATEGORY_SUGGESTION_NOT_FOUND', 'Usulan kategori tidak ditemukan');
    }
    if (suggestion.status !== 'pending') {
      throw new ConflictError('CATEGORY_SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah ditinjau');
    }

    const existing = await this.categoryRepo.findActiveByNameCaseInsensitive(suggestion.name);
    if (!existing) {
      await this.categoryRepo.create({ name: suggestion.name });
    }

    const ok = await this.suggestionRepo.approve(cmd.suggestionId, cmd.reviewerId);
    if (!ok) {
      throw new ConflictError('CATEGORY_SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah ditinjau');
    }

    await this.auditRepo.record({
      userId: cmd.reviewerId,
      action: 'create',
      entityType: 'category',
      entityId: cmd.suggestionId,
      newData: { name: suggestion.name, from: 'category_suggestion' },
      requestId: cmd.requestId ?? null,
    });

    return { ...suggestion, status: 'approved', reviewedBy: cmd.reviewerId, reviewedAt: new Date() };
  }
}

// Reject = usulan tidak jadi, alasan wajib (dikirim balik ke pengusul / dicatat).
export class RejectCategorySuggestionUseCase {
  constructor(
    private readonly suggestionRepo: CategorySuggestionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: RejectCategorySuggestionCommand): Promise<CategorySuggestion> {
    const suggestion = await this.suggestionRepo.findById(cmd.suggestionId);
    if (!suggestion) {
      throw new NotFoundError('CATEGORY_SUGGESTION_NOT_FOUND', 'Usulan kategori tidak ditemukan');
    }
    if (suggestion.status !== 'pending') {
      throw new ConflictError('CATEGORY_SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah ditinjau');
    }

    const ok = await this.suggestionRepo.reject(cmd.suggestionId, cmd.reviewerId, cmd.reason);
    if (!ok) {
      throw new ConflictError('CATEGORY_SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah ditinjau');
    }

    await this.auditRepo.record({
      userId: cmd.reviewerId,
      action: 'delete',
      entityType: 'category',
      entityId: cmd.suggestionId,
      newData: { rejected: true, reason: cmd.reason },
      requestId: cmd.requestId ?? null,
    });

    return { ...suggestion, status: 'rejected', rejectReason: cmd.reason, reviewedBy: cmd.reviewerId, reviewedAt: new Date() };
  }
}
