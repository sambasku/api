import type { MobileRelease, MobileReleasePlatform } from '../entities/mobile-release.entity';

export interface UpsertMobileReleaseInput {
  platform: MobileReleasePlatform;
  version: string;
  storeUrl?: string | null;
  notes?: string | null;
}

export interface MobileReleaseRepository {
  /** Cek terbaru untuk satu platform (publik, dari mobile). */
  findLatest(platform: MobileReleasePlatform): Promise<MobileRelease | null>;
  /** Daftar semua (admin). */
  list(): Promise<MobileRelease[]>;
  /** Upsert: insert baru jika belum ada per platform, atau update (admin). */
  upsert(input: UpsertMobileReleaseInput): Promise<MobileRelease>;
}
