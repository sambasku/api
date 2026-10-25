/**
 * Platform mobile (Android/iOS).
 */
export type MobileReleasePlatform = 'android' | 'ios';

/**
 * Status publikasi versi terbaru per platform.
 * SoT Turso, upsert dari console System > Mobile Release.
 * Mobile membandingkan dengan PackageInfo, tampil banner update jika API lebih tinggi.
 */
export interface MobileRelease {
  id: string;
  platform: MobileReleasePlatform;
  version: string;
  storeUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}
