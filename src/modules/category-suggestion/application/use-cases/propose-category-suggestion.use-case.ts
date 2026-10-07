import { ConflictError } from '@/shared/errors/app-error';
import { normalizeCategoryName } from '../../domain/normalize-category-name';
import type { CategorySuggestion } from '../../domain/entities/category-suggestion.entity';
import type { CategorySuggestionRepository } from '../../domain/repositories/category-suggestion.repository';
import type { CategoryRepository } from '@/modules/category/domain/repositories/category.repository';

export interface ProposeCategorySuggestionCommand {
  name: string;
  reason?: string;
  proposedBy?: string | null;
  contributorName?: string | null;
  wordSuggestionId?: string | null;
}

// User (login ATAU anonim) mengusulkan kategori baru (api#50). TIDAK pernah
// langsung jadi master: selalu status pending, reviewer yang approve.
// Duplikat case-insensitive ditolak - master 25 kategori yang sudah ada jangan
// kebagi varian "hewan" vs "Binatang & Hewan".
export class ProposeCategorySuggestionUseCase {
  constructor(
    private readonly suggestionRepo: CategorySuggestionRepository,
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async execute(cmd: ProposeCategorySuggestionCommand): Promise<CategorySuggestion> {
    const name = normalizeCategoryName(cmd.name);
    if (name.length < 2) {
      throw new ConflictError('CATEGORY_NAME_TOO_SHORT', 'Nama kategori minimal 2 karakter');
    }

    if (await this.categoryRepo.existsActiveNameCaseInsensitive(name)) {
      throw new ConflictError('CATEGORY_EXISTS', `Kategori "${name}" sudah ada di master`);
    }

    const pending = await this.suggestionRepo.findPendingByName(name);
    if (pending) {
      throw new ConflictError(
        'CATEGORY_SUGGESTION_PENDING',
        `Kategori "${name}" sedang menunggu tinjauan verifikator`,
      );
    }

    return this.suggestionRepo.create({
      name,
      reason: cmd.reason ?? null,
      proposedBy: cmd.proposedBy ?? null,
      contributorName: cmd.contributorName ?? null,
      wordSuggestionId: cmd.wordSuggestionId ?? null,
    });
  }
}
