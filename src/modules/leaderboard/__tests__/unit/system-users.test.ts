import { describe, expect, it } from 'vitest';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { VOTING_WARGA_USER_ID } from '@/shared/constants/voting-warga';
import { SYSTEM_USER_IDS, isSystemUserId } from '@/shared/constants/system-users';

describe('system-users', () => {
  it('menyertakan lima akun sistem bawaan', () => {
    expect(SYSTEM_USER_IDS).toHaveLength(5);
    expect(SYSTEM_USER_IDS).toContain(ANONIM_USER_ID);
    expect(SYSTEM_USER_IDS).toContain(VOTING_WARGA_USER_ID);
  });

  it('isSystemUserId mengenali id bawaan', () => {
    expect(isSystemUserId(ANONIM_USER_ID)).toBe(true);
    expect(isSystemUserId('01USER000000000000000000')).toBe(false);
  });
});