import { describe, it, expect } from 'vitest';
import { isCapacityFailure } from '@/shared/errors/infra-failure';

describe('isCapacityFailure', () => {
  it('mengenali batas subrequest Workers - kegagalan yang memicu failover', () => {
    expect(isCapacityFailure(new Error('Too many subrequests.'))).toBe(true);
    expect(
      isCapacityFailure(new Error('Worker exceeded the limit for the number of subrequests.')),
    ).toBe(true);
  });

  it('menembus error terbungkus - @libsql/client membungkus kegagalan fetch', () => {
    const wrapped = new Error('SERVER_ERROR: fetch gagal', {
      cause: new Error('Too many subrequests.'),
    });
    expect(isCapacityFailure(wrapped)).toBe(true);
  });

it('mengenali sinyal kapasitas runtime lain', () => {
  expect(isCapacityFailure(new Error('Network connection lost.'))).toBe(true);
  expect(
    isCapacityFailure(new Error('The script will never generate a response.')),
  ).toBe(true);
});

it('mengenali blokir kuota Turso - read/write dilarang, bukan bug query', () => {
  // Bentuk nyata dari tail staging 2026-10-27: LibsqlError BLOCKED
  // terbungkus DrizzleQueryError "Failed query: select ...".
  const tursoBlocked = new Error('Failed query: select "id" from "word_classes"', {
    cause: new Error(
      'BLOCKED: Operation was blocked: SQL read operations are forbidden (reads are blocked, do you need to upgrade your plan?)',
    ),
  });
  expect(isCapacityFailure(tursoBlocked)).toBe(true);
  expect(
    isCapacityFailure(
      new Error('SQL write operations are forbidden (writes are blocked...)'),
    ),
  ).toBe(true);
});

  it('TIDAK menandai bug aplikasi biasa - kalau tidak, breaker pindah tier sia-sia', () => {
    expect(isCapacityFailure(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isCapacityFailure(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'))).toBe(false);
    expect(isCapacityFailure(null)).toBe(false);
    expect(isCapacityFailure(undefined)).toBe(false);
    expect(isCapacityFailure({})).toBe(false);
  });
});
