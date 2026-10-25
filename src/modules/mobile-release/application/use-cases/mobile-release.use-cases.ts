import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { MobileReleasePlatform } from '../../domain/entities/mobile-release.entity';
import type { MobileReleaseRepository } from '../../domain/repositories/mobile-release.repository';

export class GetLatestMobileReleaseUseCase {
  constructor(private readonly repo: MobileReleaseRepository) {}

  async execute(platform: MobileReleasePlatform) {
    return this.repo.findLatest(platform);
  }
}

export class ListMobileReleasesUseCase {
  constructor(private readonly repo: MobileReleaseRepository) {}

  async execute() {
    return this.repo.list();
  }
}

export class UpsertMobileReleaseUseCase {
  constructor(
    private readonly repo: MobileReleaseRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    platform: MobileReleasePlatform;
    version: string;
    storeUrl?: string | null;
    notes?: string | null;
    userId: string;
    requestId?: string | null;
  }) {
    const result = await this.repo.upsert({
      platform: input.platform,
      version: input.version,
      storeUrl: input.storeUrl,
      notes: input.notes,
    });

    await this.auditRepo.record({
      userId: input.userId,
      action: 'upsert',
      entityType: 'mobile_release',
      entityId: result.id,
      newData: {
        platform: result.platform,
        version: result.version,
        store_url: result.storeUrl,
        notes: result.notes,
      },
      requestId: input.requestId ?? null,
    });

    return result;
  }
}
