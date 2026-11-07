export interface Sponsorship {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  logoUrl: string | null;
  url: string | null;
  username: string | null;
  since: string;
  note: string;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface NewSponsorship {
  userId?: string | null;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  username?: string | null;
  since: string;
  note?: string;
}

export interface UpdateSponsorship {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
  url?: string | null;
  username?: string | null;
  since?: string;
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
