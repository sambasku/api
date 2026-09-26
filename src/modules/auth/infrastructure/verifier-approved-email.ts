import { brandedMessageEmailHtml } from './branded-email';

export function verifierApprovedEmailText(displayName: string): string {
  return (
    `Selamat, ${displayName}.\n\n` +
    'Pengajuan Anda disetujui. Anda sekarang Verifikator SambasKu.\n\n' +
    'Terima kasih sudah bersedia menjaga ketepatan kamus bahasa Sambas bersama kami. Ini apresiasi dari tim SambasKu.\n\n' +
    'Satu langkah lagi: silakan keluar dari akun, lalu masuk kembali. Setelah itu peran Verifikator aktif dan Anda bisa mulai meninjau kontribusi.'
  );
}

export function verifierApprovedEmailHtml(displayName: string): string {
  return brandedMessageEmailHtml({
    title: 'Selamat menjadi Verifikator SambasKu',
    eyebrow: 'Verifikator',
    heading: `Selamat, ${displayName}`,
    paragraphs: [
      'Pengajuan Anda disetujui. Anda sekarang Verifikator SambasKu.',
      'Terima kasih sudah bersedia menjaga ketepatan kamus bahasa Sambas bersama kami. Ini apresiasi dari tim SambasKu.',
      'Satu langkah lagi: silakan keluar dari akun, lalu masuk kembali. Setelah itu peran Verifikator aktif dan Anda bisa mulai meninjau kontribusi.',
    ],
    footer: 'Tim SambasKu',
  });
}
