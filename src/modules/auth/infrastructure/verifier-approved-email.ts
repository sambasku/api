import { brandedMessageEmailHtml } from './branded-email';

export function verifierApprovedEmailText(displayName: string): string {
  return (
    `Selamat, ${displayName}.\n\n` +
    'Pengajuanmu disetujui. Kamu sekarang Verifikator SambasKu.\n\n' +
    'Terima kasih sudah bersedia menjaga ketepatan kamus bahasa Sambas bersama kami. Ini apresiasi dari tim SambasKu.\n\n' +
    'Satu langkah lagi: keluar dari akun, lalu masuk lagi. Setelah itu peran Verifikator aktif dan kamu bisa mulai meninjau kontribusi.'
  );
}

export function verifierApprovedEmailHtml(displayName: string): string {
  return brandedMessageEmailHtml({
    title: 'Selamat menjadi Verifikator SambasKu',
    eyebrow: 'Verifikator',
    heading: `Selamat, ${displayName}`,
    paragraphs: [
      'Pengajuanmu disetujui. Kamu sekarang Verifikator SambasKu.',
      'Terima kasih sudah bersedia menjaga ketepatan kamus bahasa Sambas bersama kami. Ini apresiasi dari tim SambasKu.',
      'Satu langkah lagi: keluar dari akun, lalu masuk lagi. Setelah itu peran Verifikator aktif dan kamu bisa mulai meninjau kontribusi.',
    ],
    footer: 'Tim SambasKu',
  });
}
