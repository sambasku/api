import type {
  CommunityCategory,
  CommunityFeaturedKind,
  CommunityOrg,
  CommunityOrgFields,
  CommunityProposal,
  CommunityProposalStatus,
  CommunityPublishStatus,
} from './community';

export interface ListCommunityOrgsInput {
  category?: CommunityCategory;
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export interface ListCommunityOrgsResult {
  items: CommunityOrg[];
  nextCursor: string | null;
}

export interface CommunityRepository {
  listPublished(input: ListCommunityOrgsInput): Promise<ListCommunityOrgsResult>;
  listManage(): Promise<CommunityOrg[]>;
  listFeatured(): Promise<CommunityOrg[]>;
  findPublishedBySlug(slug: string): Promise<CommunityOrg | null>;
  findById(id: string): Promise<CommunityOrg | null>;
  existingSlugs(candidates: string[]): Promise<Set<string>>;
  insertOrg(
    input: CommunityOrgFields & {
      slug: string;
      authorId: string | null;
      status?: CommunityPublishStatus;
    },
  ): Promise<CommunityOrg>;
  updateOrg(
    id: string,
    patch: Partial<CommunityOrgFields> & { status?: CommunityPublishStatus },
  ): Promise<void>;
  clearFeaturedKind(kind: CommunityFeaturedKind, exceptId?: string): Promise<void>;

  countOpenByUser(userId: string): Promise<number>;
  insertProposal(input: {
    userId: string;
    name: string;
    description: string;
    logoUrl: string | null;
    category: CommunityCategory;
  }): Promise<string>;
  findProposal(id: string): Promise<CommunityProposal | null>;
  listProposals(input: {
    status?: CommunityProposalStatus;
    userId?: string;
  }): Promise<CommunityProposal[]>;
  updateProposal(
    id: string,
    patch: Partial<{
      status: CommunityProposalStatus;
      reviewNote: string | null;
      reviewedBy: string | null;
      reviewedAt: Date | null;
      communityOrgId: string | null;
      category: CommunityCategory;
      name: string;
      description: string;
      logoUrl: string | null;
    }>,
  ): Promise<void>;
}
