import type { SponsorshipTier } from '@/shared/database/drizzle/schema/sponsorships.schema';

export type { SponsorshipTier };

export interface Sponsorship {
  id: string;
  userId: string | null;
  usahaId: string | null;
  name: string;
  description: string | null;
  logoUrl: string | null;
  url: string | null;
  username: string | null;
  tier: SponsorshipTier;
  since: string;
  endsOn: string | null;
  note: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface NewSponsorship {
  userId?: string | null;
  usahaId?: string | null;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  username?: string | null;
  tier?: SponsorshipTier;
  since: string;
  endsOn?: string | null;
  note?: string;
}

export interface UpdateSponsorship {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  username?: string | null;
  userId?: string | null;
  usahaId?: string | null;
  tier?: SponsorshipTier;
  since?: string;
  endsOn?: string | null;
  note?: string;
}

export interface TeamMember {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  teamAs: string | null;
  teamNote: string | null;
}

export interface ContributorListItem {
  id: string;
  username: string;
  displayName: string;
}

export interface VerifierListItem {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
