import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MobileReleaseRepository } from '../../domain/repositories/mobile-release.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  GetLatestMobileReleaseUseCase,
  ListMobileReleasesUseCase,
  UpsertMobileReleaseUseCase,
} from '../../application/use-cases/mobile-release.use-cases';

describe('MobileReleaseUseCases', () => {
  const mockRepo = {
    findLatest: vi.fn(),
    list: vi.fn(),
    upsert: vi.fn(),
  } as unknown as MobileReleaseRepository;

  const mockAuditRepo = {
    record: vi.fn(),
  } as unknown as AuditLogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GetLatestMobileReleaseUseCase', () => {
    it('returns latest release for platform', async () => {
      const mockRelease = {
        id: '01ARM5TVZJKQ',
        platform: 'android' as const,
        version: '0.1.0',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
        notes: null,
        createdAt: new Date('2026-10-24T10:00:00Z'),
        updatedAt: null,
      };
      vi.mocked(mockRepo.findLatest).mockResolvedValueOnce(mockRelease);

      const uc = new GetLatestMobileReleaseUseCase(mockRepo);
      const result = await uc.execute('android');

      expect(result).toEqual(mockRelease);
      expect(mockRepo.findLatest).toHaveBeenCalledWith('android');
    });

    it('returns null when no release exists', async () => {
      vi.mocked(mockRepo.findLatest).mockResolvedValueOnce(null);

      const uc = new GetLatestMobileReleaseUseCase(mockRepo);
      const result = await uc.execute('ios');

      expect(result).toBeNull();
    });
  });

  describe('ListMobileReleasesUseCase', () => {
    it('returns all releases', async () => {
      const mockReleases = [
        {
          id: '01ARM5TVZJKQ',
          platform: 'android' as const,
          version: '0.1.0',
          storeUrl: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
          notes: null,
          createdAt: new Date('2026-10-24T10:00:00Z'),
          updatedAt: null,
        },
        {
          id: '01ARM5TVZJKR',
          platform: 'ios' as const,
          version: '0.0.8',
          storeUrl: null,
          notes: 'iOS listing pending',
          createdAt: new Date('2026-10-23T15:00:00Z'),
          updatedAt: new Date('2026-10-24T09:00:00Z'),
        },
      ];
      vi.mocked(mockRepo.list).mockResolvedValueOnce(mockReleases);

      const uc = new ListMobileReleasesUseCase(mockRepo);
      const result = await uc.execute();

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockReleases);
    });

    it('returns empty list when no releases exist', async () => {
      vi.mocked(mockRepo.list).mockResolvedValueOnce([]);

      const uc = new ListMobileReleasesUseCase(mockRepo);
      const result = await uc.execute();

      expect(result).toHaveLength(0);
    });
  });

  describe('UpsertMobileReleaseUseCase', () => {
    it('upserts release and records audit log', async () => {
      const mockResult = {
        id: '01ARM5TVZJKQ',
        platform: 'android' as const,
        version: '0.2.0',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
        notes: 'Bug fixes',
        createdAt: new Date('2026-10-24T10:00:00Z'),
        updatedAt: new Date('2026-10-24T11:00:00Z'),
      };
      vi.mocked(mockRepo.upsert).mockResolvedValueOnce(mockResult);

      const uc = new UpsertMobileReleaseUseCase(mockRepo, mockAuditRepo);
      const result = await uc.execute({
        platform: 'android',
        version: '0.2.0',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
        notes: 'Bug fixes',
        userId: '01USER123',
        requestId: 'req-123',
      });

      expect(result).toEqual(mockResult);
      expect(mockRepo.upsert).toHaveBeenCalledWith({
        platform: 'android',
        version: '0.2.0',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
        notes: 'Bug fixes',
      });
      expect(mockAuditRepo.record).toHaveBeenCalledWith({
        userId: '01USER123',
        action: 'upsert',
        entityType: 'mobile_release',
        entityId: mockResult.id,
        newData: {
          platform: 'android',
          version: '0.2.0',
          store_url: 'https://play.google.com/store/apps/details?id=com.iamutaki.sambasku',
          notes: 'Bug fixes',
        },
        requestId: 'req-123',
      });
    });

    it('handles null storeUrl and notes', async () => {
      const mockResult = {
        id: '01ARM5TVZJKS',
        platform: 'ios' as const,
        version: '0.1.0',
        storeUrl: null,
        notes: null,
        createdAt: new Date('2026-10-24T10:00:00Z'),
        updatedAt: null,
      };
      vi.mocked(mockRepo.upsert).mockResolvedValueOnce(mockResult);

      const uc = new UpsertMobileReleaseUseCase(mockRepo, mockAuditRepo);
      const result = await uc.execute({
        platform: 'ios',
        version: '0.1.0',
        userId: '01USER456',
        requestId: null,
      });

      expect(result).toEqual(mockResult);
      expect(mockAuditRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '01USER456',
          newData: expect.objectContaining({ platform: 'ios' }),
          requestId: null,
        }),
      );
    });
  });
});
