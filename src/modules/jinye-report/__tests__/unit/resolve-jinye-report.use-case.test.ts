import { describe, expect, it, vi } from 'vitest';
import { ResolveJinyeReportUseCase } from '../../application/use-cases/resolve-jinye-report.use-case';
import type { JinyeReportRepository } from '../../domain/repositories/jinye-report.repository';
import type { JinyeReportWithTarget } from '../../domain/entities/jinye-report.entity';

function openReport(
  overrides: Partial<JinyeReportWithTarget> = {},
): JinyeReportWithTarget {
  return {
    id: 'rep1',
    targetType: 'jinye',
    targetId: 'j1',
    userId: 'u-reporter',
    username: 'reporter',
    displayName: 'Reporter',
    reasonCode: 'spam',
    note: null,
    status: 'open',
    resolution: null,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: null,
    targetBody: 'halo',
    targetHasImages: false,
    targetHasAudio: false,
    targetStatus: 'published',
    targetUserId: 'u-author',
    targetUsername: 'author',
    targetDisplayName: 'Author',
    ...overrides,
  };
}

describe('ResolveJinyeReportUseCase', () => {
  it('dismissed menutup satu laporan tanpa takedown', async () => {
    const row = openReport();
    const reports = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({ ...row, status: 'dismissed', resolution: 'dismissed' }),
      resolve: vi.fn().mockResolvedValue(true),
      resolveAllOpenForTarget: vi.fn(),
    } as unknown as JinyeReportRepository;
    const takedownJinye = { execute: vi.fn() };
    const takedownComment = { execute: vi.fn() };
    const audit = { record: vi.fn() };

    const out = await new ResolveJinyeReportUseCase(
      reports,
      takedownJinye as never,
      takedownComment as never,
      audit as never,
    ).execute({
      id: 'rep1',
      resolution: 'dismissed',
      note: 'bukan pelanggaran',
      actorId: 'admin1',
    });

    expect(takedownJinye.execute).not.toHaveBeenCalled();
    expect(reports.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rep1', resolution: 'dismissed' }),
    );
    expect(out.status).toBe('dismissed');
  });

  it('taken_down memanggil takedown lalu resolveAllOpenForTarget', async () => {
    const row = openReport();
    const reports = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({
          ...row,
          status: 'resolved',
          resolution: 'taken_down',
        }),
      resolve: vi.fn(),
      resolveAllOpenForTarget: vi.fn().mockResolvedValue(undefined),
    } as unknown as JinyeReportRepository;
    const takedownJinye = { execute: vi.fn().mockResolvedValue({}) };
    const takedownComment = { execute: vi.fn() };
    const audit = { record: vi.fn() };

    await new ResolveJinyeReportUseCase(
      reports,
      takedownJinye as never,
      takedownComment as never,
      audit as never,
    ).execute({
      id: 'rep1',
      resolution: 'taken_down',
      note: 'spam',
      actorId: 'admin1',
    });

    expect(takedownJinye.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1', actorId: 'admin1' }),
    );
    expect(reports.resolveAllOpenForTarget).toHaveBeenCalled();
    expect(reports.resolve).not.toHaveBeenCalled();
  });

  it('sudah ditutup → ConflictError', async () => {
    const reports = {
      findById: vi.fn().mockResolvedValue(openReport({ status: 'dismissed' })),
    } as unknown as JinyeReportRepository;

    await expect(
      new ResolveJinyeReportUseCase(
        reports,
        { execute: vi.fn() } as never,
        { execute: vi.fn() } as never,
        { record: vi.fn() } as never,
      ).execute({
        id: 'rep1',
        resolution: 'dismissed',
        actorId: 'admin1',
      }),
    ).rejects.toMatchObject({ errorCode: 'REPORT_ALREADY_RESOLVED' });
  });
});
