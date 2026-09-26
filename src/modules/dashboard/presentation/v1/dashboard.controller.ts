import type { Context } from 'hono';
import type { GetDashboardStatsUseCase } from '../../application/use-cases/get-dashboard-stats.use-case';
import type { DashboardStats } from '../../domain/entities/dashboard-stats.entity';

export class DashboardController {
  constructor(private readonly deps: { getStats: GetDashboardStatsUseCase }) {}

  async stats(c: Context) {
    const stats = await this.deps.getStats.execute();
    // Controller = boundary HTTP: map entitas (camelCase) → kontrak wire
    // (snake_case, mengikuti konvensi semua endpoint admin).
    return c.json({ success: true as const, data: toWireStats(stats) });
  }
}

export type DashboardStatsWire = ReturnType<typeof toWireStats>;

function toWireStats(stats: DashboardStats) {
  return {
    words: {
      total: stats.words.total,
      verified: stats.words.verified,
      deleted: stats.words.deleted,
      by_status: stats.words.byStatus,
    },
    contributions: {
      total: stats.contributions.total,
      by_status: stats.contributions.byStatus,
    },
    users: {
      active: stats.users.active,
      by_role: stats.users.byRole,
    },
    activity: {
      audit_logs_last_7_days: stats.activity.auditLogsLast7Days,
      daily_last_30_days: stats.activity.dailyLast30Days.map((point) => ({
        date: point.date,
        contributions: point.contributions,
        votes: point.votes,
        comments: point.comments,
        new_users: point.newUsers,
      })),
    },
    problems: {
      open: stats.problems.open,
      closed: stats.problems.closed,
      by_source: {
        bug_reports: {
          open: stats.problems.bySource.bugReports.open,
          closed: stats.problems.bySource.bugReports.closed,
        },
        word_reports: {
          open: stats.problems.bySource.wordReports.open,
          closed: stats.problems.bySource.wordReports.closed,
        },
      },
    },
  };
}
