import { createMiddleware } from 'hono/factory';
import type { AppVariables } from '@/shared/types';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';

/**
 * Gerbang consent legal untuk aksi tulis kontributor.
 *
 * Dipasang SETELAH authenticate. Menolak 403 CONSENT_REQUIRED bila user
 * belum menyetujui terms/privacy versi aktif. Read path tidak digerbang.
 *
 * Saklar `legal.oauth_consent_enforcement` mengatur gate ini juga:
 * - `lenient` (default): aksi tulis LOLOS tanpa cek consent - app lama
 *   tidak stuck. Consent tetap dicatat (register/backfill/login sosial),
 *   `requires_consent` di /users/me tetap jalan, mobile baru tetap
 *   menampilkan sheet.
 * - `enforce`: cek penuh - 403 bila consent basi/hilang.
 * Satu flag untuk kedua gerbang supaya saat H+90% flip `enforce`
 * mengaktifkan semuanya sekaligus, tanpa deploy ulang.
 *
 * ponytail: 2 query per request tulis saat enforce (versi aktif + 2
 * konsen terakhir). Kalau jadi panas, upgrade ke klaim consent_ok di JWT
 * yang di-refresh saat accept-legal.
 */
export function createRequireLegalConsentMiddleware(
  settingsRepo: AppSettingsRepository,
  consentRepo: UserConsentRepository,
) {
  return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get('user');
    // Mount opsional (contributions/words dengan optionalAuthenticate):
    // tamu tanpa token tetap boleh kirim. Route lain sudah lewat
    // authenticate, jadi cabang ini tidak pernah tercapai di sana.
    if (!user) {
      await next();
      return;
    }

    // Mode lenient = gate mati (semua lolos, tidak ada query consent).
    const mode = await settingsRepo.getOauthConsentEnforcement();
    if (mode !== 'enforce') {
      await next();
      return;
    }

    const active = await settingsRepo.getLegalActiveVersions();
    // Legal belum dikonfigurasi: tidak ada dokumen yang bisa disetujui -
    // jangan blok aksi (konsisten dengan register yang menolak di jalur lain).
    if (!active) {
      await next();
      return;
    }

    // Satu query untuk kedua tipe (bukan 2 subrequest terpisah).
    const latest = await consentRepo.findLatestByUserAll(user.user_id);
    if (
      latest.terms?.documentVersion === active.termsVersion &&
      latest.privacy?.documentVersion === active.privacyVersion
    ) {
      await next();
      return;
    }

    return c.json(
      {
        success: false as const,
        error_code: 'CONSENT_REQUIRED',
        message: 'Setujui Syarat dan Ketentuan dulu ya',
        details: [{ field: 'consents', message: 'Buka app SambasKu dan setujui versi terbaru' }],
      },
      403,
    );
  });
}
