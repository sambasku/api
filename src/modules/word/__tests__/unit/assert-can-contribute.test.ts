import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertCanContribute,
  bindCanContributeLookup,
} from '@/modules/word/application/utils/assert-can-contribute';
import { ForbiddenError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';

describe('assertCanContribute (expanded gate)', () => {
  beforeEach(() => {
    bindCanContributeLookup(async () => null);
  });

  it('skip anonim', async () => {
    await expect(assertCanContribute(ANONIM_USER_ID)).resolves.toBeUndefined();
  });

  it('403 ACCOUNT_INACTIVE', async () => {
    bindCanContributeLookup(async () => ({
      isActive: false,
      canContribute: true,
      contributeMutedUntil: null,
    }));
    await expect(assertCanContribute('01USER')).rejects.toMatchObject({
      errorCode: 'ACCOUNT_INACTIVE',
    });
  });

  it('403 CONTRIBUTION_MUTED saat muted_until masih aktif', async () => {
    bindCanContributeLookup(async () => ({
      isActive: true,
      canContribute: true,
      contributeMutedUntil: new Date(Date.now() + 60_000),
    }));
    try {
      await assertCanContribute('01USER');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).errorCode).toBe('CONTRIBUTION_MUTED');
    }
  });

  it('403 CONTRIBUTION_NOT_ALLOWED', async () => {
    bindCanContributeLookup(async () => ({
      isActive: true,
      canContribute: false,
      contributeMutedUntil: null,
    }));
    await expect(assertCanContribute('01USER')).rejects.toMatchObject({
      errorCode: 'CONTRIBUTION_NOT_ALLOWED',
    });
  });

  it('lewati bila mute sudah lewat', async () => {
    bindCanContributeLookup(async () => ({
      isActive: true,
      canContribute: true,
      contributeMutedUntil: new Date(Date.now() - 60_000),
    }));
    await expect(assertCanContribute('01USER')).resolves.toBeUndefined();
  });
});
