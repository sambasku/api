import type { Context } from 'hono';
import type {
  CreateSponsorshipUseCase,
  DeleteSponsorshipUseCase,
  ListAdminSponsorshipsUseCase,
  ListContributorsUseCase,
  ListPublicSponsorshipsUseCase,
  ListTeamUseCase,
  ListVerifiersUseCase,
  SetUserSponsorUseCase,
  UpdateSponsorshipUseCase,
} from '../../application/use-cases/about.use-cases';
import type { Sponsorship } from '../../domain/entities/about.entity';
import type {
  ContributorsListQuery,
  CreateSponsorshipBody,
  ListAdminSponsorshipsQuery,
  UpdateSponsorshipBody,
} from './validators/about.validator';

function toSponsorshipWire(s: Sponsorship) {
  return {
    id: s.id,
    user_id: s.userId,
    name: s.name,
    description: s.description,
    logo_url: s.logoUrl,
    url: s.url,
    username: s.username,
    since: s.since,
    note: s.note,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt ? s.updatedAt.toISOString() : null,
  };
}

export class AboutController {
  constructor(
    private readonly deps: {
      listTeam: ListTeamUseCase;
      listPublicSponsorships: ListPublicSponsorshipsUseCase;
      listAdminSponsorships: ListAdminSponsorshipsUseCase;
      createSponsorship: CreateSponsorshipUseCase;
      updateSponsorship: UpdateSponsorshipUseCase;
      deleteSponsorship: DeleteSponsorshipUseCase;
      setUserSponsor: SetUserSponsorUseCase;
      listContributors: ListContributorsUseCase;
      listVerifiers: ListVerifiersUseCase;
    },
  ) {}

  async listTeam(c: Context) {
    const items = await this.deps.listTeam.execute();
    return c.json({
      success: true as const,
      data: {
        items: items.map((m) => ({
          username: m.username,
          display_name: m.displayName,
          avatar_url: m.avatarUrl,
          team_as: m.teamAs,
          team_note: m.teamNote,
        })),
      },
    });
  }

  async listPublicSponsorships(c: Context) {
    const items = await this.deps.listPublicSponsorships.execute();
    return c.json({
      success: true as const,
      data: { items: items.map(toSponsorshipWire) },
    });
  }

  async listAdminSponsorships(c: Context, query: ListAdminSponsorshipsQuery) {
    const { items, nextCursor, hasMore } = await this.deps.listAdminSponsorships.execute({
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: items.map(toSponsorshipWire),
      meta: {
        limit: query.limit,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  }

  async createSponsorship(c: Context, body: CreateSponsorshipBody) {
    const created = await this.deps.createSponsorship.execute({
      name: body.name,
      description: body.description ?? null,
      logoUrl: body.logo_url ?? null,
      url: body.url ?? null,
      username: body.username ?? null,
      since: body.since,
      note: body.note ?? '',
      userId: body.user_id ?? null,
    });
    return c.json({ success: true as const, data: toSponsorshipWire(created) });
  }

  async updateSponsorship(c: Context, id: string, body: UpdateSponsorshipBody) {
    const updated = await this.deps.updateSponsorship.execute(id, {
      name: body.name,
      description: body.description,
      logoUrl: body.logo_url,
      url: body.url,
      username: body.username,
      since: body.since,
      note: body.note,
    });
    return c.json({ success: true as const, data: toSponsorshipWire(updated) });
  }

  async deleteSponsorship(c: Context, id: string) {
    await this.deps.deleteSponsorship.execute(id);
    return c.json({ success: true as const, data: null });
  }

  async setUserSponsor(c: Context, userId: string, isSponsor: boolean) {
    const row = await this.deps.setUserSponsor.execute(userId, isSponsor);
    return c.json({
      success: true as const,
      data: {
        is_sponsor: row != null,
        sponsorship: row ? toSponsorshipWire(row) : null,
      },
    });
  }

  async listContributors(c: Context, query: ContributorsListQuery) {
    const page = await this.deps.listContributors.execute({
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: {
        items: page.items.map((i) => ({
          username: i.username,
          display_name: i.displayName,
        })),
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
        total: page.total,
      },
    });
  }

  async listVerifiers(c: Context) {
    const items = await this.deps.listVerifiers.execute();
    return c.json({
      success: true as const,
      data: {
        items: items.map((i) => ({
          username: i.username,
          display_name: i.displayName,
          avatar_url: i.avatarUrl,
        })),
      },
    });
  }
}
