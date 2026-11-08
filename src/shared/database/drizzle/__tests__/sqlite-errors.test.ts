import { describe, expect, it } from 'vitest';
import {
  isUniqueViolation,
  isUniqueViolationOn,
  isUsernameHandleConstraint,
} from '../sqlite-errors';

/** Bentuk error produksi: LibsqlError (cause-chain) dibungkus drizzle "Failed query". */
function prodLikeShape(message: string) {
  const cause = Object.assign(new Error(`LibsqlError: SQLITE_CONSTRAINT: SQLite error: ${message}`), {
    code: 'SQLITE_CONSTRAINT',
  });
  return new Error(`Failed query: insert into "users" ... params: fedi`, { cause });
}

describe('isUsernameHandleConstraint', () => {
  it('deteksi RAISE(ABORT) trigger guard username di dalam cause-chain', () => {
    const err = prodLikeShape('username harus handle lowercase a-z0-9._ sepanjang 6-30');
    expect(isUsernameHandleConstraint(err)).toBe(true);
  });

  it('bukan unique violation (tidak boleh masuk jalur 409 email/username)', () => {
    const err = prodLikeShape('username harus handle lowercase a-z0-9._ sepanjang 6-30');
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('error lain tidak terdeteksi', () => {
    expect(isUsernameHandleConstraint(prodLikeShape('UNIQUE constraint failed: users.username'))).toBe(false);
    expect(isUsernameHandleConstraint(new Error('no such table'))).toBe(false);
    expect(isUsernameHandleConstraint(null)).toBe(false);
  });

  it('isUniqueViolationOn tetap jalan untuk unique biasa', () => {
    const cause = Object.assign(new Error('UNIQUE constraint failed: users.username'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    const err = new Error('Failed query: insert into users', { cause });
    expect(isUniqueViolationOn(err, 'username')).toBe(true);
    expect(isUsernameHandleConstraint(err)).toBe(false);
  });
});
