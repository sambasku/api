import { describe, it, expect } from 'vitest';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import { resolveDiscussionNotifyRecipients } from '../../application/utils/resolve-discussion-notify-recipients';

describe('resolveDiscussionNotifyRecipients', () => {
  const actor = '01ACTOR0000000000000000000';
  const owner = '01OWNER0000000000000000000';
  const prior = '01PRIOR0000000000000000000';

  it('gabungkan prior + owner, buang aktor', () => {
    expect(
      resolveDiscussionNotifyRecipients({
        actorId: actor,
        ownerUserId: owner,
        priorParticipantIds: [prior, actor],
      }).sort(),
    ).toEqual([owner, prior].sort());
  });

  it('skip anonim dan pengimpor CSV', () => {
    expect(
      resolveDiscussionNotifyRecipients({
        actorId: actor,
        ownerUserId: CSV_IMPORTER_USER_ID,
        priorParticipantIds: [ANONIM_USER_ID, prior],
      }),
    ).toEqual([prior]);
  });

  it('owner null → hanya prior (minus aktor)', () => {
    expect(
      resolveDiscussionNotifyRecipients({
        actorId: actor,
        ownerUserId: null,
        priorParticipantIds: [prior],
      }),
    ).toEqual([prior]);
  });

  it('tanpa peserta lain → kosong', () => {
    expect(
      resolveDiscussionNotifyRecipients({
        actorId: actor,
        ownerUserId: actor,
        priorParticipantIds: [actor],
      }),
    ).toEqual([]);
  });
});
