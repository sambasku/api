import type { UgcAbuseEventRepository } from '@/shared/moderation/ugc-abuse-event.repository';

export class ListUserAbuseEventsUseCase {
  constructor(private readonly abuseRepo: UgcAbuseEventRepository) {}

  async execute(cmd: { userId: string; limit: number; cursor?: string }) {
    return this.abuseRepo.listByUser(cmd.userId, {
      limit: cmd.limit,
      cursor: cmd.cursor,
    });
  }
}
