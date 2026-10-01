import type { MentionUserRow } from '../../domain/entities/public-profile.entity';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

export const MENTION_SUGGEST_LIMIT = 10;

export class SuggestMentionUsersUseCase {
  constructor(private readonly publicUserRepo: PublicUserRepository) {}

  /** Autocomplete mention @username (38-api-mention.md). Tanpa PII. */
  async execute(prefix: string): Promise<MentionUserRow[]> {
    const clean = prefix.trim().toLowerCase();
    if (clean.length < 2) return [];
    return this.publicUserRepo.suggestByUsernamePrefix(clean, MENTION_SUGGEST_LIMIT);
  }
}
