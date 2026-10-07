import { describe, expect, it } from 'vitest';

import { updateMyProfileSchema } from '@/modules/user/presentation/v1/validators/update-my-profile.validator';

// #98: mobile selalu mengirim ketiga key (json_serializable includeIfNull
// default true) - submit profil tak pernah isi has_read_contribution_guide
// → null. z.literal(true).optional() menolak null → 422 "Beberapa isian
// belum sesuai" padahal isian user valid.
describe('updateMyProfileSchema', () => {
  it('menerima has_read_contribution_guide: null (diabaikan, bukan error)', () => {
    const parsed = updateMyProfileSchema.safeParse({
      display_name: 'Kapsaloy',
      bio: null,
      has_read_contribution_guide: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.has_read_contribution_guide).toBeUndefined();
    expect(parsed.data.display_name).toBe('Kapsaloy');
    expect(parsed.data.bio).toBeNull();
  });

  it('has_read_contribution_guide: true tetap diterima', () => {
    const parsed = updateMyProfileSchema.safeParse({
      display_name: 'Kapsaloy',
      has_read_contribution_guide: true,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.has_read_contribution_guide).toBe(true);
  });

  it('has_read_contribution_guide: false tetap ditolak (sekali jalan)', () => {
    expect(
      updateMyProfileSchema.safeParse({
        display_name: 'Kapsaloy',
        has_read_contribution_guide: false,
      }).success,
    ).toBe(false);
  });

  it('refine: tanpa field sama sekali tetap ditolak', () => {
    expect(updateMyProfileSchema.safeParse({}).success).toBe(false);
  });

  it('display_name kosong tetap ditolak', () => {
    expect(
      updateMyProfileSchema.safeParse({ display_name: '   ' }).success,
    ).toBe(false);
  });
});
