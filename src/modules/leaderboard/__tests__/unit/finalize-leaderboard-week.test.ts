import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

describe('FinalizeLeaderboardWeekUseCase', () => {
  it('tidak memanggil snapshot XP di dalam finalize (deferred ke cron job)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(dir, '../../application/use-cases/finalize-leaderboard-week.use-case.ts'),
      'utf8',
    );
    expect(source).not.toContain('UserXpSnapshotPort');
    expect(source).not.toContain('saveUserWeekStats');
    expect(source).not.toContain('leaderboard finalize xp snapshot failed');
  });
});