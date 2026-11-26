export type ProfileCoverVariant = 'tab' | 'public' | 'wotd';

export const PROFILE_COVER_VARIANTS = ['tab', 'public', 'wotd'] as const;

export const PROFILE_COVER_DIMENSIONS: Record<
  ProfileCoverVariant,
  { width: number; height: number }
> = {
  tab: { width: 1032, height: 400 },
  public: { width: 1032, height: 534 },
  /** Kartu Kata Hari Ini (strip beranda mobile, ~5.86:1). */
  wotd: { width: 1032, height: 176 },
};

export interface ProfileCover {
  id: string;
  variant: ProfileCoverVariant;
  url: string;
  fileId: string | null;
  width: number;
  height: number;
  sizeBytes: number | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  activatedAt: Date | null;
}

export interface ActiveProfileCovers {
  tabUrl: string | null;
  publicUrl: string | null;
  wotdUrl: string | null;
}