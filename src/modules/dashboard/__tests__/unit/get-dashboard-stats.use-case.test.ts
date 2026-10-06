import { describe, it, expect, vi } from 'vitest';
import { GetDashboardStatsUseCase } from '../../application/use-cases/get-dashboard-stats.use-case';
import type { DashboardRepository } from '../../domain/repositories/dashboard.repository';
import type { DashboardStats } from '../../domain/entities/dashboard-stats.entity';
import {
  fillDailyActivityLast30Days,
  mapBugProblemCounts,
  mapVerifierApplicationCounts,
  mapWordProblemCounts,
  shiftCalendarDate,
  startOfWibDayUtc,
  wibDateString,
} from '../../infrastructure/dashboard.repository.impl';

function emptyDaily(): DashboardStats['activity']['dailyLast30Days'] {
  return fillDailyActivityLast30Days(
    { contributions: [], votes: [], comments: [], newUsers: [], searches: [] },
    '2026-09-27',
  );
}

const EMPTY_PROBLEMS: DashboardStats['problems'] = {
  open: 0,
  closed: 0,
  bySource: {
    bugReports: { open: 0, closed: 0 },
    wordReports: { open: 0, closed: 0 },
  },
};

const EMPTY_VERIFIER_APPS: DashboardStats['verifierApplications'] = {
  pending: 0,
  approved: 0,
  rejected: 0,
};

const EMPTY_STATS: DashboardStats = {
  words: {
    total: 0,
    verified: 0,
    deleted: 0,
    byStatus: { draft: 0, pending_review: 0, published: 0, rejected: 0 },
  },
  contributions: {
    total: 0,
    byStatus: { pending: 0, approved: 0, rejected: 0, corrected: 0 },
  },
  users: { active: 0, onlineRecently: 0, byRole: { root: 0, admin: 0, editor: 0, reviewer: 0, contributor: 0 } },
  activity: { auditLogsLast7Days: 0, dailyLast30Days: emptyDaily() },
  problems: EMPTY_PROBLEMS,
  verifierApplications: EMPTY_VERIFIER_APPS,
};

describe('GetDashboardStatsUseCase', () => {
  it('meneruskan hasil agregasi repository tanpa modifikasi', async () => {
    const sample: DashboardStats = {
      words: {
        total: 10,
        verified: 8,
        deleted: 2,
        byStatus: { draft: 1, pending_review: 2, published: 6, rejected: 1 },
      },
      contributions: {
        total: 5,
        byStatus: { pending: 3, approved: 1, rejected: 1, corrected: 0 },
      },
      users: { active: 5, onlineRecently: 2, byRole: { root: 1, admin: 1, editor: 1, reviewer: 1, contributor: 1 } },
      activity: {
        auditLogsLast7Days: 15,
        dailyLast30Days: fillDailyActivityLast30Days(
          {
            contributions: [{ day: '2026-09-27', count: 2 }],
            votes: [{ day: '2026-09-27', count: 4 }],
            comments: [],
            newUsers: [{ day: '2026-09-26', count: 1 }],
            searches: [{ day: '2026-09-27', count: 7 }],
          },
          '2026-09-27',
        ),
      },
      problems: {
        open: 3,
        closed: 5,
        bySource: {
          bugReports: { open: 1, closed: 3 },
          wordReports: { open: 2, closed: 2 },
        },
      },
      verifierApplications: { pending: 2, approved: 4, rejected: 1 },
    };
    const repo = { getStats: vi.fn().mockResolvedValue(sample) } as unknown as DashboardRepository;
    const useCase = new GetDashboardStatsUseCase(repo);
    await expect(useCase.execute()).resolves.toEqual(sample);
    expect(repo.getStats).toHaveBeenCalledTimes(1);
  });

  it('dataset kosong → semua angka 0 (default record terisi)', async () => {
    const repo = { getStats: vi.fn().mockResolvedValue(EMPTY_STATS) } as unknown as DashboardRepository;
    const useCase = new GetDashboardStatsUseCase(repo);
    const stats = await useCase.execute();
    expect(stats.words.total).toBe(0);
    expect(stats.contributions.byStatus.pending).toBe(0);
    expect(stats.users.active).toBe(0);
    expect(stats.activity.auditLogsLast7Days).toBe(0);
    expect(stats.problems.open).toBe(0);
    expect(stats.problems.closed).toBe(0);
    expect(stats.verifierApplications).toEqual({ pending: 0, approved: 0, rejected: 0 });
    expect(stats.activity.dailyLast30Days).toHaveLength(30);
    expect(
      stats.activity.dailyLast30Days.every(
        (p) =>
          p.contributions === 0 &&
          p.votes === 0 &&
          p.comments === 0 &&
          p.newUsers === 0 &&
          p.searches === 0,
      ),
    ).toBe(true);
  });
});

describe('dashboard daily activity helpers', () => {
  it('wibDateString menggeser ke kalender WIB', () => {
    expect(wibDateString(new Date('2026-09-26T20:00:00.000Z'))).toBe('2026-09-27');
    expect(wibDateString(new Date('2026-09-26T16:00:00.000Z'))).toBe('2026-09-26');
  });

  it('shiftCalendarDate menggeser YYYY-MM-DD tanpa zona', () => {
    expect(shiftCalendarDate('2026-09-27', -29)).toBe('2026-08-29');
    expect(shiftCalendarDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('startOfWibDayUtc = tengah malam WIB sebagai Instant', () => {
    expect(startOfWibDayUtc('2026-09-27').toISOString()).toBe('2026-09-26T17:00:00.000Z');
  });

  it('fillDailyActivityLast30Days: length 30, merge 5 series, gap = 0', () => {
    const points = fillDailyActivityLast30Days(
      {
        contributions: [
          { day: '2026-09-27', count: 3 },
          { day: '2026-09-20', count: 1 },
        ],
        votes: [{ day: '2026-09-27', count: 5 }],
        comments: [{ day: '2026-09-21', count: 2 }],
        newUsers: [{ day: '2026-09-20', count: 1 }],
        searches: [{ day: '2026-09-27', count: 9 }],
      },
      '2026-09-27',
    );
    expect(points).toHaveLength(30);
    expect(points[0]?.date).toBe('2026-08-29');
    expect(points[29]?.date).toBe('2026-09-27');
    expect(points[29]).toMatchObject({
      contributions: 3,
      votes: 5,
      comments: 0,
      newUsers: 0,
      searches: 9,
    });
  });
});

describe('problem count mappers', () => {
  it('mapBugProblemCounts: open vs resolved+rejected', () => {
    expect(
      mapBugProblemCounts([
        { status: 'open', count: 4 },
        { status: 'resolved', count: 2 },
        { status: 'rejected', count: 1 },
      ]),
    ).toEqual({ open: 4, closed: 3 });
  });

  it('mapWordProblemCounts: open vs resolved', () => {
    expect(
      mapWordProblemCounts([
        { status: 'open', count: 7 },
        { status: 'resolved', count: 5 },
      ]),
    ).toEqual({ open: 7, closed: 5 });
  });

  it('mapVerifierApplicationCounts: pending/approved/rejected', () => {
    expect(
      mapVerifierApplicationCounts([
        { status: 'pending', count: 3 },
        { status: 'approved', count: 8 },
        { status: 'rejected', count: 2 },
      ]),
    ).toEqual({ pending: 3, approved: 8, rejected: 2 });
  });
});
