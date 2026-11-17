import type {
  KaryaFilmType,
  KaryaKind,
  KaryaMusicReleaseType,
  KaryaPublishStatus,
} from '@/shared/database/drizzle/schema/karyas.schema';
import type { KaryaContributionKind, KaryaContributionStatus } from '@/shared/database/drizzle/schema/karya-contributions.schema';
import type {
  KaryaExcerptKind,
  KaryaExcerptRightsStatus,
} from '@/shared/database/drizzle/schema/karya-excerpts.schema';
export const KARYA_SAMBAS_CONNECTION_TYPES = [
  'creator_origin',
  'language',
  'location',
  'theme',
  'other',
] as const;
export type SambasConnectionType = (typeof KARYA_SAMBAS_CONNECTION_TYPES)[number];

export const KARYA_ACCESS_LINK_KINDS = [
  'listen',
  'watch',
  'buy',
  'read',
  'stream',
  'official',
  'other',
] as const;
export type AccessLinkKind = (typeof KARYA_ACCESS_LINK_KINDS)[number];

export interface KaryaAuthorRef {
  id: string;
  username: string;
  displayName: string;
}

export interface SambasConnection {
  type: SambasConnectionType;
  note: string;
}

export interface AccessLink {
  kind: AccessLinkKind;
  label: string;
  url: string;
  isPrimary?: boolean;
}

export interface KaryaCredit {
  id?: string;
  role: string;
  nameText: string;
  kreatorId: string | null;
  kreatorSlug?: string | null;
  sortOrder: number;
}

export interface KaryaExcerpt {
  id: string;
  kind: KaryaExcerptKind;
  text: string;
  language: string | null;
  startLabel: string | null;
  endLabel: string | null;
  rightsStatus: KaryaExcerptRightsStatus;
  rightsNote?: string | null;
  sourceUrl: string | null;
}

export interface KaryaFields {
  title: string;
  year: number;
  kind: KaryaKind;
  language: string | null;
  description: string | null;
  coverUrl: string | null;
  sambasConnections: SambasConnection[];
  accessLinks: AccessLink[];
  credits: KaryaCredit[];
  musicReleaseType: KaryaMusicReleaseType | null;
  musicDurationMs: number | null;
  musicIsCover: boolean;
  filmType: KaryaFilmType | null;
  filmRuntimeMin: number | null;
}

export interface Karya extends KaryaFields {
  id: string;
  slug: string;
  publishStatus: KaryaPublishStatus;
  authorId: string | null;
  author: KaryaAuthorRef | null;
  excerpts?: KaryaExcerpt[];
  createdAt: Date;
  updatedAt: Date | null;
}

export interface KaryaExcerptFields {
  kind: KaryaExcerptKind;
  text: string;
  language: string | null;
  startLabel: string | null;
  endLabel: string | null;
  rightsStatus: KaryaExcerptRightsStatus;
  rightsNote: string | null;
  sourceUrl: string | null;
}

export interface ExcerptContributionPayload {
  kind: 'excerpt';
  excerpt: KaryaExcerptFields;
}

export type KaryaContributionPayload = KaryaFields | ExcerptContributionPayload;

export interface KaryaContribution {
  id: string;
  kind: KaryaContributionKind;
  userId: string;
  username: string | null;
  karyaId: string | null;
  payload: KaryaContributionPayload;
  status: KaryaContributionStatus;
  resultKaryaId: string | null;
  resultExcerptId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function slugifyKarya(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'karya';
}

export function parseSambasConnectionsJson(raw: string): SambasConnection[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const type = row.type;
        const note = typeof row.note === 'string' ? row.note.trim() : '';
        if (
          typeof type !== 'string' ||
          !note ||
          !['creator_origin', 'language', 'location', 'theme', 'other'].includes(type)
        ) {
          return null;
        }
        return { type, note } as SambasConnection;
      })
      .filter((x): x is SambasConnection => x != null);
  } catch {
    return [];
  }
}

export function parseAccessLinksJson(raw: string): AccessLink[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const kind = typeof row.kind === 'string' ? row.kind : '';
        const label = typeof row.label === 'string' ? row.label.trim() : '';
        const url = typeof row.url === 'string' ? row.url.trim() : '';
        if (!kind || !label || !url) return null;
        const link: AccessLink = {
          kind: kind as AccessLinkKind,
          label,
          url,
        };
        if (row.is_primary === true || row.isPrimary === true) {
          link.isPrimary = true;
        }
        return link;
      })
      .filter((x): x is AccessLink => x != null);
  } catch {
    return [];
  }
}

export function isExcerptContributionPayload(
  payload: KaryaContributionPayload,
): payload is ExcerptContributionPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'kind' in payload &&
    (payload as { kind: string }).kind === 'excerpt' &&
    'excerpt' in payload
  );
}