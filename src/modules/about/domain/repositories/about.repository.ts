import type {
  ContributorListItem,
  NewSponsorship,
  Sponsorship,
  TeamMember,
  UpdateSponsorship,
  VerifierListItem,
} from '../entities/about.entity';

export interface ListContributorsPage {
  items: ContributorListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AboutRepository {
  listTeam(): Promise<TeamMember[]>;
  listSponsorships(): Promise<Sponsorship[]>;
  listSponsorshipsAdmin(limit: number, cursor?: string): Promise<{
    items: Sponsorship[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  findSponsorshipById(id: string): Promise<Sponsorship | null>;
  findActiveSponsorshipByUserId(userId: string): Promise<Sponsorship | null>;
  createSponsorship(data: NewSponsorship): Promise<Sponsorship>;
  updateSponsorship(id: string, data: UpdateSponsorship): Promise<Sponsorship | null>;
  softDeleteSponsorship(id: string): Promise<boolean>;
  /** Checkbox sponsor: upsert aktif atau restore soft-deleted. */
  setUserSponsor(userId: string, isSponsor: boolean): Promise<Sponsorship | null>;
  listContributors(limit: number, cursor?: string): Promise<ListContributorsPage>;
  listVerifiers(): Promise<VerifierListItem[]>;
  /** User IDs yang punya sponsorship aktif (untuk enrich list admin). */
  listActiveSponsorUserIds(userIds: string[]): Promise<Set<string>>;
}
