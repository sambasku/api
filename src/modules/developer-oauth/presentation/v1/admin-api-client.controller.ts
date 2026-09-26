import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type {
  CreateAdminApiClientUseCase,
  GetAdminApiClientUseCase,
  ListAdminApiClientsUseCase,
  UpdateAdminApiClientUseCase,
} from '../../application/use-cases/admin-api-client.use-cases';
import type {
  CreateAdminApiClientBody,
  ListAdminApiClientsQuery,
  UpdateAdminApiClientBody,
} from './validators/api-client.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

export class AdminApiClientController {
  constructor(
    private readonly deps: {
      list: ListAdminApiClientsUseCase;
      get: GetAdminApiClientUseCase;
      create: CreateAdminApiClientUseCase;
      update: UpdateAdminApiClientUseCase;
    },
  ) {}

  async list(c: AdminCtx, query: ListAdminApiClientsQuery) {
    const data = await this.deps.list.execute({
      status: query.status,
      isFirstParty: query.is_first_party,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({ success: true as const, data });
  }

  async get(c: AdminCtx, id: string) {
    const data = await this.deps.get.execute(id);
    return c.json({ success: true as const, data });
  }

  async create(c: AdminCtx, body: CreateAdminApiClientBody) {
    const user = this.requireUser(c);
    const data = await this.deps.create.execute({
      clientId: body.client_id,
      name: body.name,
      description: body.description,
      status: body.status,
      homepageUrl: body.homepage_url,
      privacyUrl: body.privacy_url,
      redirectUris: body.redirect_uris,
      allowedScopes: body.allowed_scopes,
      allowedChannels: body.allowed_channels,
      rateLimitTier: body.rate_limit_tier,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data }, 201);
  }

  async update(c: AdminCtx, id: string, body: UpdateAdminApiClientBody) {
    const user = this.requireUser(c);
    const data = await this.deps.update.execute({
      id,
      patch: {
        name: body.name,
        description: body.description,
        status: body.status,
        homepageUrl: body.homepage_url,
        privacyUrl: body.privacy_url,
        redirectUris: body.redirect_uris,
        allowedScopes: body.allowed_scopes,
        allowedChannels: body.allowed_channels,
        rateLimitTier: body.rate_limit_tier,
      },
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data });
  }

  private requireUser(c: AdminCtx): AuthUser {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }
}
