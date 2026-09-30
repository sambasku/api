import { describe, expect, it } from 'vitest';
import {
  resetPasswordEmailHtml,
  resetPasswordEmailText,
} from '../../infrastructure/reset-password-email';
import { OTP_EMAIL_LOGO_CONTENT_ID } from '../../infrastructure/otp-email-logo';

describe('reset-password-email', () => {
  it('teks memuat kode XXX-YYY tanpa tautan', () => {
    const text = resetPasswordEmailText('A4K-9M2');
    expect(text).toContain('A4K-9M2');
    expect(text).toContain('10 menit');
    expect(text).toContain('aplikasi');
    expect(text).not.toContain('http');
  });

  it('html memuat kode dan avatar CID, tanpa tombol tautan', () => {
    const html = resetPasswordEmailHtml('A4K-9M2');
    expect(html).toContain('A4K-9M2');
    expect(html).toContain('6 karakter 0-9A-Z');
    expect(html).toContain('XXX-YYY');
    expect(html).toContain(`cid:${OTP_EMAIL_LOGO_CONTENT_ID}`);
    expect(html).toContain('width="96"');
    expect(html).not.toContain('Atur password baru');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<script');
  });

  it('html meng-escape karakter berbahaya di kode', () => {
    expect(resetPasswordEmailHtml('<b>x</b>')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
