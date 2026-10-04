import type { Context } from 'hono';

/**
 * Deteksi klien browser untuk gerbang kanal refresh token.
 *
 * Latar (issue #34): refresh_token via body JSON aman untuk app native
 * (Dio, simpan di Keychain/Keystore), tapi berbahaya bila dipakai web
 * client - token tersimpan terjangkau JavaScript sehingga satu XSS bisa
 * mencurinya. Browser dilarang lewat jalur body; wajib cookie httpOnly.
 *
 * Dua sinyal, cukup salah satu:
 * - `Origin`: fetch/XHR POST dari browser SELALU menyertakan header ini
 *   (forbidden header, JS tidak bisa menyembunyikannya). App native
 *   (Dio/dart:io) tidak pernah mengirim.
 * - `User-Agent` pola browser: UA adalah forbidden header di browser -
 *   fetch/XHR tidak bisa memalsukannya. Pola mencakup Chrome/Safari/
 *   Firefox/Edge/WebKit semua platform, termasuk WebView.
 *
 * Catatan: cURL tanpa UA juga lolos gerbang ini. Itu disengaja - cURL
 * tidak punya XSS, threat model ini hanya JavaScript di halaman web.
 */
const BROWSER_UA_PATTERN =
  /Mozilla\/|AppleWebKit\/|Chrome\/|Chromium\/|Firefox\/|FxiOS\/|Edg\/|Safari\/|Gecko\/|MSIE |Trident\//;

export function isBrowserClient(headers: {
  origin?: string | null;
  'user-agent'?: string | null;
}): boolean {
  if (headers.origin) return true;
  const ua = headers['user-agent'];
  return !!ua && BROWSER_UA_PATTERN.test(ua);
}

/** Header request sebagai argumen isBrowserClient. */
export function browserSignalHeaders(c: Context) {
  return {
    origin: c.req.header('Origin'),
    'user-agent': c.req.header('User-Agent'),
  };
}
