export type ConsentDocumentType = 'terms' | 'privacy';
/**
 * Asal-usul persetujuan:
 * - register: user centang checkbox saat daftar
 * - social_gate: user setuju lewat sheet setelah login sosial
 * - seed_backfill: diisi script migrasi untuk user existing
 * - reconsent: setujui ulang setelah versi dokumen berubah
 * - accept_legal: endpoint /accept-legal
 */
export type ConsentSource =
  | 'register'
  | 'social_gate'
  | 'seed_backfill'
  | 'reconsent'
  | 'accept_legal';

export interface UserConsent {
  id: string;
  userId: string;
  documentType: ConsentDocumentType;
  documentVersion: string;
  acceptedAt: Date;
  source: ConsentSource;
  clientId: string | null;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface NewUserConsent {
  userId: string;
  documentType: ConsentDocumentType;
  documentVersion: string;
  source: ConsentSource;
  clientId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  acceptedAt?: Date;
}
