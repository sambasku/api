import { ANONIM_USER_ID } from './anonim';
import { CSV_IMPORTER_USER_ID } from './csv-importer';
import { GITHUB_ACTIONS_USER_ID } from './github-actions';
import { LIVE_TIKTOK_USER_ID } from './live-tiktok';
import { WEB_IMPORT_USER_ID } from './web-importer';
import { VOTING_WARGA_USER_ID } from './voting-warga';

/** Akun sistem bawaan (bukan login manusia). Sumber tunggal untuk seed/migrasi. */
export const SYSTEM_USER_IDS = [
  ANONIM_USER_ID,
  CSV_IMPORTER_USER_ID,
  GITHUB_ACTIONS_USER_ID,
  LIVE_TIKTOK_USER_ID,
  WEB_IMPORT_USER_ID,
  VOTING_WARGA_USER_ID,
] as const;

export type SystemUserId = (typeof SYSTEM_USER_IDS)[number];

export const SYSTEM_USER_ID_SET = new Set<string>(SYSTEM_USER_IDS);

export function isSystemUserId(userId: string): boolean {
  return SYSTEM_USER_ID_SET.has(userId);
}