import type { ConsentDocumentType } from '@/modules/legal/domain/entities/user-consent.entity';

export interface GithubLoginDto {
  accessToken: string;
  /** Persetujuan legal - wajib untuk akun baru (mode enforce). */
  consents?: Array<{ documentType: ConsentDocumentType; documentVersion: string }>;
}
