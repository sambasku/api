import { z } from 'zod';

/** Sama dengan id wilayah: slug, opsional satu slash untuk desa. */
const REGION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

function nullableRegionId(message: string) {
  return z
    .string()
    .trim()
    .max(64, message)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v == null || REGION_SLUG.test(v), { message });
}

export const updateMyProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, 'Nama tampilan wajib diisi')
      .max(100, 'Nama tampilan maksimal 100 karakter')
      .optional(),
    bio: z
      .string()
      .trim()
      .max(500, 'Bio maksimal 500 karakter')
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    region_id: nullableRegionId('Kecamatan tidak valid. Pilih ulang dari daftar.'),
    village_id: nullableRegionId('Desa tidak valid. Pilih ulang dari daftar.'),
    // Guide sekali jalan: hanya boleh true, tidak bisa di-reset ke belum baca.
    // #98: mobile (json_serializable) selalu ikut mengirim key ini - null saat
    // tak diisi → terima null sebagai "tidak diubah", bukan 422.
    has_read_contribution_guide: z
      .literal(true)
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
  })
  .refine(
    (body) =>
      body.display_name !== undefined ||
      body.bio !== undefined ||
      body.has_read_contribution_guide !== undefined ||
      body.region_id !== undefined ||
      body.village_id !== undefined,
    {
      message:
        'Minimal satu field (display_name, bio, region_id, village_id, atau has_read_contribution_guide) harus diisi',
    },
  );

export type UpdateMyProfileBody = z.infer<typeof updateMyProfileSchema>;

export const myProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    username: z.string(),
    display_name: z.string(),
    bio: z.string().nullable(),
    region_id: z.string().nullable(),
    village_id: z.string().nullable(),
    avatar_url: z.string().url().nullable(),
    has_read_contribution_guide: z.boolean(),
  }),
});
