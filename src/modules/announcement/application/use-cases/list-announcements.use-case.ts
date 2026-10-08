import type { AnnouncementRepository } from '../../domain/repositories/announcement.repository';
import type { ListAnnouncementsResult } from '../../domain/repositories/announcement.repository';

export class ListAnnouncementsUseCase {
  constructor(private readonly repo: AnnouncementRepository) {}

  async execute(input: { limit: number; before?: string }): Promise<ListAnnouncementsResult> {
    return this.repo.list(input);
  }
}


