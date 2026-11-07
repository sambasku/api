import type {
  NewSponsorship,
  Sponsorship,
  TeamMember,
  UpdateSponsorship,
  VerifierListItem,
} from '../../domain/entities/about.entity';
import type {
  AboutRepository,
  ListContributorsPage,
} from '../../domain/repositories/about.repository';
import { NotFoundError } from '@/shared/errors/app-error';

export class ListTeamUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(): Promise<TeamMember[]> {
    return this.repo.listTeam();
  }
}

export class ListPublicSponsorshipsUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(): Promise<Sponsorship[]> {
    return this.repo.listSponsorships();
  }
}

export class ListAdminSponsorshipsUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(input: { limit: number; cursor?: string }) {
    return this.repo.listSponsorshipsAdmin(input.limit, input.cursor);
  }
}

export class CreateSponsorshipUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(data: NewSponsorship): Promise<Sponsorship> {
    return this.repo.createSponsorship(data);
  }
}

export class UpdateSponsorshipUseCase {
  constructor(private readonly repo: AboutRepository) {}
  async execute(id: string, data: UpdateSponsorship): Promise<Sponsorship> {
    const updated = await this.repo.updateSponsorship(id, data);
    if (!updated) {
      throw new NotFoundError('NOT_FOUND', 'Sponsorship tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteSponsorshipUseCase {
  constructor(private readonly repo: AboutRepository) {}
  async execute(id: string): Promise<void> {
    const ok = await this.repo.softDeleteSponsorship(id);
    if (!ok) {
      throw new NotFoundError('NOT_FOUND', 'Sponsorship tidak ditemukan');
    }
  }
}

export class SetUserSponsorUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(userId: string, isSponsor: boolean): Promise<Sponsorship | null> {
    return this.repo.setUserSponsor(userId, isSponsor);
  }
}

export class ListContributorsUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(input: { limit: number; cursor?: string }): Promise<ListContributorsPage> {
    return this.repo.listContributors(input.limit, input.cursor);
  }
}

export class ListVerifiersUseCase {
  constructor(private readonly repo: AboutRepository) {}
  execute(): Promise<VerifierListItem[]> {
    return this.repo.listVerifiers();
  }
}
