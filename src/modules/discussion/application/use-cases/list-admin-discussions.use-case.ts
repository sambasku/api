import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import type {
  Discussion,
  DiscussionStatus,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export class ListAdminDiscussionsUseCase {
  constructor(private readonly repo: DiscussionRepository) {}

  execute(input: {
    status?: DiscussionStatus;
    limit: number;
    cursor?: string;
  }): Promise<CursorPage<Discussion>> {
    return this.repo.list({
      status: input.status,
      limit: input.limit,
      cursor: input.cursor,
    });
  }
}
