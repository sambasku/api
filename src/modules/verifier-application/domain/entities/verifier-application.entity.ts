export type VerifierApplicationStatus = 'pending' | 'approved' | 'rejected';

/** Dialek kamus Sambas, plus jalan keluar "lainnya" yang wajib punya catatan. */
export const VERIFIER_DIALECT_CODES = ['umum', 'kota', 'pesisir', 'lainnya'] as const;
export type VerifierDialect = (typeof VERIFIER_DIALECT_CODES)[number];

/** Kontribusi berstatus approved sebelum pengajuan boleh dikirim. */
export const MIN_APPROVED_CONTRIBUTIONS = 3;

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x' | 'website';

export interface SocialScreenshot {
  url: string;
  provider_file_id: string;
}

export interface SocialLink {
  platform: SocialPlatform;
  username: string;
  screenshot: SocialScreenshot;
}

export interface VerifierApplication {
  id: string;
  userId: string;
  username: string | null;
  phone: string;
  address: string;
  socialLinks: SocialLink[];
  /** Null pada baris sebelum kolom nama lengkap ada. */
  fullName: string | null;
  /** Null pada baris sebelum kolom dialek ada. */
  dialect: VerifierDialect | null;
  dialectNote: string | null;
  reason: string | null;
  photo: SocialScreenshot | null;
  status: VerifierApplicationStatus;
  adminComment: string | null;
  reviewedBy: string | null;
  /** Username admin/root yang memutuskan; null jika belum direview atau akun reviewer hilang. */
  reviewedByUsername: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface NewVerifierApplication {
  userId: string;
  phone: string;
  address: string;
  socialLinks: SocialLink[];
  fullName: string;
  dialect: VerifierDialect;
  dialectNote: string | null;
  reason: string;
  photo: SocialScreenshot | null;
}

export interface VerifierApplicationListItem {
  id: string;
  userId: string;
  username: string | null;
  phone: string;
  status: VerifierApplicationStatus;
  createdAt: Date;
}
