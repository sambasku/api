import type { CategorySuggestion } from '../entities/category-suggestion.entity';

export interface CreateCategorySuggestionInput {
  name: string;
  reason?: string | null;
  proposedBy?: string | null;
  contributorName?: string | null;
  wordSuggestionId?: string | null;
}

export interface CategorySuggestionRepository {
  create(input: CreateCategorySuggestionInput): Promise<CategorySuggestion>;
  findById(id: string): Promise<CategorySuggestion | null>;
  findPendingByName(name: string): Promise<CategorySuggestion | null>;
  list(status?: 'pending' | 'approved' | 'rejected', limit?: number): Promise<CategorySuggestion[]>;
  approve(id: string, reviewerId: string): Promise<boolean>;
  reject(id: string, reviewerId: string, reason: string): Promise<boolean>;
}
