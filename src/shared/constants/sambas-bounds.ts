/**
 * Kotak produk Kabupaten Sambas.
 *
 * Acuan Nominatim bbox kabupaten (~0.96…2.08 lat, ~108.9…109.8 lng) +
 * margin aman. Utara harus menutup Temajuk/Paloh (~1.997°N).
 * Selaras mobile `inSambasBounds` / Nominatim viewbox.
 */
export const SAMBAS_LAT_MIN = 0.9;
export const SAMBAS_LAT_MAX = 2.15;
export const SAMBAS_LNG_MIN = 108.5;
export const SAMBAS_LNG_MAX = 110.1;

/** `viewbox` Nominatim: left,top,right,bottom */
export const SAMBAS_NOMINATIM_VIEWBOX = `${SAMBAS_LNG_MIN},${SAMBAS_LAT_MAX},${SAMBAS_LNG_MAX},${SAMBAS_LAT_MIN}`;

export function inSambasBounds(lat: number, lng: number): boolean {
  return (
    lat >= SAMBAS_LAT_MIN &&
    lat <= SAMBAS_LAT_MAX &&
    lng >= SAMBAS_LNG_MIN &&
    lng <= SAMBAS_LNG_MAX
  );
}
