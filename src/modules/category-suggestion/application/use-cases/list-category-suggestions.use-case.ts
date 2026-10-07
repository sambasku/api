import type { CategorySuggestion } from '../../domain/entities/category-suggestion.entity';
import type { CategorySuggestionRepository } from '../../domain/repositories/category-suggestion.repository';

// Antrean moderasi usulan kategori - default pending (yang perlu ditinjau).
export class ListCategorySuggestionsUseCase {
  constructor(private readonly suggestionRepo: CategorySuggestionRepository) {}

  async execute(opts: {
    status?: 'pending' | 'approved' | 'rejected';
    limit?: number;
  } = {}): Promise<CategorySuggestion[]> {
    return this.suggestionRepo.list(opts.status, opts.limit);
  }
}
