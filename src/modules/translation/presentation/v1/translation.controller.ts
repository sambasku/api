import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { Translation } from '../../domain/entities/translation.entity';
import type { CreateTranslationUseCase } from '../../application/use-cases/create-translation.use-case';
import type { ListTranslationsUseCase } from '../../application/use-cases/list-translations.use-case';
import type { ResolveTranslationUseCase } from '../../application/use-cases/resolve-translation.use-case';
import type {
  CreateTranslationBody,
  ListTranslationsQuery,
  ResolveTranslationBody,
} from './validators/translation.validator';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toWire(row: Translation) {
  return {
    id: row.id,
    reff: row.reff,
    reff_id: row.reffId,
    source_body: row.sourceBody,
    body: row.body,
    status: row.status,
    translator_id: row.translatorId,
    reviewed_by: row.reviewedBy,
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export class TranslationController {
  constructor(
    private readonly deps: {
      create: CreateTranslationUseCase;
      list: ListTranslationsUseCase;
      resolve: ResolveTranslationUseCase;
    },
  ) {}

  async list(
    c: Context<{ Variables: AppVariables }>,
    query: ListTranslationsQuery,
  ) {
    const items = await this.deps.list.execute({
      reff: query.reff,
      reffId: query.reff_id,
      status: query.status,
      limit: query.limit,
    });
    return c.json({ data: items.map(toWire) });
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    body: CreateTranslationBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.create.execute({
      reff: body.reff,
      reffId: body.reff_id,
      body: body.body,
      translatorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row) }, 201);
  }

  async resolve(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: ResolveTranslationBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.resolve.execute({
      id,
      action: body.action,
      reviewerId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row) });
  }
}
