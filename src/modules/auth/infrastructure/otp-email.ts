import { brandedCodeEmailHtml } from './branded-email';

export const DEFAULT_MAIL_FROM = 'SambasKu <no-reply@sambasku.com>';

export function otpEmailText(displayCode: string): string {
  return (
    `Kode verifikasi SambasKu (berlaku 10 menit): ${displayCode}\n\n` +
    'Jangan bagikan kode ini. Abaikan email ini jika kamu tidak sedang mendaftar.'
  );
}

export function otpEmailHtml(displayCode: string): string {
  return brandedCodeEmailHtml({
    title: 'Kode verifikasi SambasKu',
    eyebrow: 'Verifikasi akun',
    intro: 'Masukkan 6 karakter 0-9A-Z di aplikasi',
    code: displayCode,
    note: 'Berlaku 10 menit. Format tampilan XXX-YYY.',
    footer: 'Jangan bagikan kode ini. Abaikan email ini jika kamu tidak sedang mendaftar di SambasKu.',
  });
}
