/** Email instruksi bayar Baleho (setelah moderasi lolos). */

export function balehoPaymentEmailText(input: {
  displayName: string;
  placementId: string;
  sizeLabel: string;
  positionLabel: string;
}): string {
  return [
    `Halo ${input.displayName},`,
    '',
    'Pesanan Baleho kamu sudah lolos pengecekan dan menunggu pembayaran.',
    `ID pesanan: ${input.placementId}`,
    `Ukuran: ${input.sizeLabel}`,
    `Posisi: ${input.positionLabel}`,
    '',
    'Bayar dalam 48 jam. Balas email ini atau hubungi tim SambasKu lewat WhatsApp di nomor yang terdaftar di profil kamu untuk instruksi rekening.',
    'Kalau lewat 48 jam tanpa bayar, area dilepas otomatis.',
    '',
    'Terima kasih,',
    'Tim SambasKu',
  ].join('\n');
}

export function balehoPaymentEmailHtml(input: {
  displayName: string;
  placementId: string;
  sizeLabel: string;
  positionLabel: string;
}): string {
  const name = escapeHtml(input.displayName);
  return `<p>Halo ${name},</p>
<p>Pesanan Baleho kamu sudah lolos pengecekan dan menunggu pembayaran.</p>
<ul>
  <li>ID pesanan: <code>${escapeHtml(input.placementId)}</code></li>
  <li>Ukuran: ${escapeHtml(input.sizeLabel)}</li>
  <li>Posisi: ${escapeHtml(input.positionLabel)}</li>
</ul>
<p>Bayar dalam <strong>48 jam</strong>. Balas email ini atau hubungi tim SambasKu lewat WhatsApp di nomor yang terdaftar di profil kamu untuk instruksi rekening.</p>
<p>Kalau lewat 48 jam tanpa bayar, area dilepas otomatis.</p>
<p>Terima kasih,<br/>Tim SambasKu</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
