/**
 * Decode Open Location Code (Plus Code) → lat/lng.
 *
 * Share Maps tipe GPS sering hanya bawa Plus Code di path
 * (`F6HG+CFG Sakura Mart…`) tanpa `!3d`/`@`. Browser JS baru
 * melengkapi URL; fetch server berhenti di hop itu.
 *
 * Vendor: `vendor/openlocationcode.js` (Apache-2.0, Google).
 */
import {
  SAMBAS_LAT_MAX,
  SAMBAS_LAT_MIN,
  SAMBAS_LNG_MAX,
  SAMBAS_LNG_MIN,
  type MapsCoords,
} from './parse-maps-url';
import { OpenLocationCode } from './vendor/openlocationcode.js';

const coder = new OpenLocationCode();

/** Titik tengah kotak produk - acuan recover short Plus Code. */
export const SAMBAS_PLUS_CODE_REF = {
  lat: (SAMBAS_LAT_MIN + SAMBAS_LAT_MAX) / 2,
  lng: (SAMBAS_LNG_MIN + SAMBAS_LNG_MAX) / 2,
} as const;

export function coordsFromPlusCode(
  code: string,
  ref: { lat: number; lng: number } = SAMBAS_PLUS_CODE_REF,
): MapsCoords | null {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  try {
    const full = coder.isShort(trimmed)
      ? coder.recoverNearest(trimmed, ref.lat, ref.lng)
      : trimmed;
    if (!coder.isFull(full)) return null;
    const area = coder.decode(full);
    const lat = Number(area.latitudeCenter);
    const lng = Number(area.longitudeCenter);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
