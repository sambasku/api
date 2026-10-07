import { CategoryRepositoryImpl } from '@/modules/category/infrastructure/category.repository.impl';
import { CategorySuggestionRepositoryImpl } from '@/modules/category-suggestion/infrastructure/category-suggestion.repository.impl';
import { ProposeCategorySuggestionUseCase } from '@/modules/category-suggestion/application/use-cases/propose-category-suggestion.use-case';
import { ListCategorySuggestionsUseCase } from '@/modules/category-suggestion/application/use-cases/list-category-suggestions.use-case';
import { ApproveCategorySuggestionUseCase, RejectCategorySuggestionUseCase } from '@/modules/category-suggestion/application/use-cases/review-category-suggestion.use-case';
import { CategorySuggestionController } from '@/modules/category-suggestion/presentation/v1/category-suggestion.controller';

export const createCategorySuggestionModule = (deps: { db: any; auditRepo: any; config?: any }) => {
  const categoryRepo = new CategoryRepositoryImpl(deps.db);
  const suggestionRepo = new CategorySuggestionRepositoryImpl(deps.db);
  const propose = new ProposeCategorySuggestionUseCase(suggestionRepo, categoryRepo);
  const list = new ListCategorySuggestionsUseCase(suggestionRepo);
  const approve = new ApproveCategorySuggestionUseCase(suggestionRepo, categoryRepo, deps.auditRepo);
  const reject = new RejectCategorySuggestionUseCase(suggestionRepo, deps.auditRepo);
  const controller = new CategorySuggestionController({
    propose,
    list,
    approve,
    reject,
  });
  return { controller, categoryRepo, suggestionRepo };
};
