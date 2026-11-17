import type { KreatorKind } from '@/shared/database/drizzle/schema/kreators.schema';
import type { KaryaKind } from '@/shared/database/drizzle/schema/karyas.schema';
import type { KreatorClaimStatus } from '@/shared/database/drizzle/schema/kreator-claims.schema';

export interface KreatorLink {
  label: string;
  url: string;
}

export interface Kreator {
  id: string;
  slug: string;
  displayName: string;
  kind: KreatorKind;
  bio: string | null;
  originRegion: string | null;
  links: KreatorLink[];
  createdAt: Date;
  updatedAt: Date | null;
}

export interface KaryaSummaryForKreator {
  id: string;
  slug: string;
  title: string;
  kind: KaryaKind;
  year: number;
  role: string;
}

export interface KreatorWithKaryas {
  kreator: Kreator;
  karyas: KaryaSummaryForKreator[];
}

export interface KreatorClaim {
  id: string;
  kreatorId: string;
  userId: string;
  status: KreatorClaimStatus;
  proofNote: string;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface KreatorClaimWithMeta extends KreatorClaim {
  kreatorSlug?: string;
  kreatorDisplayName?: string;
}

export function slugifyKreator(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'kreator';
}

export function parseKreatorLinksJson(raw: string): KreatorLink[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        if (typeof o.label !== 'string' || typeof o.url !== 'string') return null;
        return { label: o.label.trim(), url: o.url.trim() };
      })
      .filter((x): x is KreatorLink => !!x && x.label.length > 0 && x.url.length > 0);
  } catch {
    return [];
  }
}