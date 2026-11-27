import type {
  CommunityFeaturedKind,
  CommunityPublishStatus,
} from '@/shared/database/drizzle/schema/community-orgs.schema';
import type { CommunityProposalStatus } from '@/shared/database/drizzle/schema/community-proposals.schema';

export type {
  CommunityFeaturedKind,
  CommunityPublishStatus,
  CommunityProposalStatus,
};

export const COMMUNITY_DESC_MAX = 320;
export const COMMUNITY_PENDING_CAP = 10;
/** Fallback bila client tidak kirim kategori. */
export const COMMUNITY_CATEGORY_DEFAULT = 'lain';

export interface CommunityCategoryRef {
  id: string;
  name: string;
}

export interface CommunityOrg {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  categoryName: string | null;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: CommunityPublishStatus;
  isFeaturedKind: CommunityFeaturedKind | null;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CommunityOrgFields {
  name: string;
  categoryId: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  isFeaturedKind?: CommunityFeaturedKind | null;
}

export interface CommunityProposal {
  id: string;
  userId: string;
  username: string | null;
  name: string;
  description: string;
  logoUrl: string | null;
  categoryId: string;
  categoryName: string | null;
  status: CommunityProposalStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  communityOrgId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export function slugifyCommunity(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'komunitas';
}
