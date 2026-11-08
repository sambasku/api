import type { LayananCategory, LayananPublishStatus } from '@/shared/database/drizzle/schema/layanans.schema';
import type {
  LayananContributionKind,
  LayananContributionStatus,
} from '@/shared/database/drizzle/schema/layanan-contributions.schema';

export interface LayananFields {
  category: LayananCategory;
  name: string;
  phone: string;
  whatsapp: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  regionId: string;
  villageId: string | null;
  note: string | null;
}

export interface Layanan extends LayananFields {
  id: string;
  slug: string;
  regionName: string | null;
  regionSlug: string | null;
  villageName: string | null;
  publishStatus: LayananPublishStatus;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LayananContribution {
  id: string;
  kind: LayananContributionKind;
  userId: string;
  username: string | null;
  layananId: string | null;
  payload: LayananFields;
  status: LayananContributionStatus;
  resultLayananId: string | null;
  revisionNote: string | null;
  rejectReasonCode: string | null;
  rejectReasonText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  reviewedAt: Date | null;
}

export function slugifyLayanan(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return base || 'layanan';
}
