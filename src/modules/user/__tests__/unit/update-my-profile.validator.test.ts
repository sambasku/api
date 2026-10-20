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

  it('region_id dan village_id null diterima', () => {
    const parsed = updateMyProfileSchema.safeParse({
      region_id: null,
      village_id: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.region_id).toBeNull();
    expect(parsed.data.village_id).toBeNull();
  });

  it('string kosong wilayah menjadi null', () => {
    const parsed = updateMyProfileSchema.safeParse({
      region_id: '',
      village_id: '  ',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.region_id).toBeNull();
    expect(parsed.data.village_id).toBeNull();
  });

  it('id wilayah rusak ditolak', () => {
    expect(
      updateMyProfileSchema.safeParse({ region_id: 'Pemangkat' }).success,
    ).toBe(false);
    expect(
      updateMyProfileSchema.safeParse({ village_id: 'pemangkat/Perapakan' }).success,
    ).toBe(false);
  });

  it('slug desa dengan satu slash diterima', () => {
    const parsed = updateMyProfileSchema.safeParse({
      region_id: 'pemangkat',
      village_id: 'pemangkat/perapakan',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.village_id).toBe('pemangkat/perapakan');
  });

  it('id wilayah 26 karakter diterima', () => {
    const id = '01MD5DDYS0YATK69KTSWAFVKFD';
    const parsed = updateMyProfileSchema.safeParse({
      region_id: id,
      village_id: id,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.village_id).toBe(id);
  });
});
