import { BadRequestError } from '@/shared/errors/app-error';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { UserConsentRepository } from '@/modules/legal/domain/repositories/user-consent.repository';
import type { ConsentInput } from '@/modules/legal/application/utils/validate-consents';
import { assertConsentsMatchActiveVersions } from '@/modules/legal/application/utils/validate-consents';

export interface SocialConsentOutcome {
  /** True bila user masih harus melihat sheet persetujuan setelah login ini. */
  needsConsent: boolean;
}

/**
 * Konsen untuk login sosial (Google/GitHub/Facebook).
 *
 * - consents dikirim (app baru): validasi versi SEBELUM akun dibuat
 *   (LEGAL_CONSENT_OUTDATED bila basi) -> simpan source 'register'.
 * - consents TIDAK dikirim:
 *   - mode lenient -> akun dibuat, TANPA baris consent (needsConsent true
 *     supaya sheet muncul). Backfill otomatis dihapus: baris consent hanya
 *     boleh lahir dari aksi eksplisit user, bukan dari server.
 *   - mode enforce -> CONSENT_REQUIRED (akun baru dilarang tanpa consent)
 * - Akun existing tanpa consent (app lama/backlog): needsConsent = true,
 *   tanpa backfill. /users/me tetap requires_consent sampai user setuju.
 * - Legal belum dikonfigurasi: jangan blok login, jangan tulis consent.
 */
export class SocialConsentService {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly consentRepo: UserConsentRepository,
  ) {}

  /** Panggil SEBELUM user baru dibuat. Boleh throw CONSENT_REQUIRED / OUTDATED. */
  async assertForNewUser(consents: ConsentInput[] | null | undefined): Promise<void> {
    const active = await this.settingsRepo.getLegalActiveVersions();
    if (!active) return; // legal belum dikonfigurasi: jangan blok
    if (!consents || consents.length === 0) {
      const mode = await this.settingsRepo.getOauthConsentEnforcement();
      if (mode === 'enforce') {
        throw new BadRequestError(
          'CONSENT_REQUIRED',
          'Persetujuan Syarat Ketentuan dan Kebijakan Privasi wajib',
          [{ field: 'consents', message: 'Daftar dulu lewat halaman Daftar ya' }],
        );
      }
      return; // lenient: buat akun tanpa consent, sheet yang minta
    }
    assertConsentsMatchActiveVersions(consents, active);
  }

  /**
   * Panggil SETELAH user dibuat/ditemukan. Menulis consent HANYA bila
   * client mengirim persetujuan eksplisit (checkbox halaman Daftar).
   */
  async recordForLogin(
    userId: string,
    consents: ConsentInput[] | null | undefined,
    meta: { clientId?: string | null; requestId?: string | null },
  ): Promise<SocialConsentOutcome> {
    const active = await this.settingsRepo.getLegalActiveVersions();
    // Legal belum dikonfigurasi: tidak ada yang bisa disetujui.
    if (!active) return { needsConsent: false };

    const latest = await this.consentRepo.findLatestByUser(userId, 'terms');
    const upToDate = latest?.documentVersion === active.termsVersion;
    // Jalur eksplisit: user mencentang checkbox di halaman Daftar.
    // Ini juga menangani user existing yang datang lewat halaman Daftar -
    // persetujuannya jangan dibuang (dulu hilang -> sheet memaksa setuju
    // ulang padahal baru saja centang).
    if (consents && consents.length > 0) {
      const byType = new Map(consents.map((c) => [c.documentType, c.documentVersion]));
      const matchesActive =
        byType.get('terms') === active.termsVersion &&
        byType.get('privacy') === active.privacyVersion;
      if (matchesActive) {
        if (!upToDate) {
          await this.insertBoth(userId, active.termsVersion, active.privacyVersion, meta);
        }
        return { needsConsent: false };
      }
      // Versi dari client tidak cocok dengan aktif (app lama / cache
      // basi). Jangan menulis persetujuan ke versi yang tidak pernah
      // dilihat user - minta lewat sheet di bawah.
    }

    if (upToDate) return { needsConsent: false };

    // Belum pernah setuju: JANGAN tulis apa pun. Baris consent hanya boleh
    // lahir dari aksi eksplisit user (checkbox Daftar atau /accept-legal).
    // Dulu di sini ada backfill source 'social_gate' - akibatnya
    // /users/me langsung balas requires_consent false dan sheet tidak
    // pernah muncul untuk akun baru.
    if (!latest) return { needsConsent: true };

    // Versi basi: sengaja TIDAK ditimpa di sini. Riwayat persetujuan lama
    // tetap utuh; user setuju ulang eksplisit lewat /accept-legal
    // (source 'reconsent') setelah membaca versi baru.
    return { needsConsent: true };
  }

  private async insertBoth(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
    meta: { clientId?: string | null; requestId?: string | null },
  ): Promise<void> {
    await this.consentRepo.insertMany([
      {
        userId,
        documentType: 'terms',
        documentVersion: termsVersion,
        source: 'register',
        clientId: meta.clientId ?? null,
        requestId: meta.requestId ?? null,
      },
      {
        userId,
        documentType: 'privacy',
        documentVersion: privacyVersion,
        source: 'register',
        clientId: meta.clientId ?? null,
        requestId: meta.requestId ?? null,
      },
    ]);
  }
}
