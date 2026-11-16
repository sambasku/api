import { NotFoundError } from '@/shared/errors/app-error';
import type { DiscussionLemmaLink } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export class ListDiscussionLemmaLinksUseCase {
  constructor(private readonly repo: DiscussionRepository) {}

  async execute(discussionId: string): Promise<DiscussionLemmaLink[]> {
    const help = await this.repo.findById(discussionId);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }
    return this.repo.listLemmaLinksByDiscussionId(discussionId);
  }
}
