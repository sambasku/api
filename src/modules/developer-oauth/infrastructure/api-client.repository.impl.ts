import { and, desc, eq, lt } from 'drizzle-orm';
import { apiClients } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { generateId } from '@/shared/utils/ulid';
import type {
  ApiClient,
  ApiClientChannel,
  ApiClientStatus,
} from '../domain/entities/api-client.entity';
import type {
  ApiClientListFilter,
  ApiClientListResult,
  ApiClientRepository,
  CreateApiClientInput,
  UpdateApiClientInput,
} from '../domain/repositories/api-client.repository';

type Row = typeof apiClients.$inferSelect;

function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function toEntity(row: Row): ApiClient {
  return {
    id: row.id,
    clientId: row.clientId,
    clientSecretHash: row.clientSecretHash,
    name: row.name,
    description: row.description,
    ownerUserId: row.ownerUserId,
    status: row.status as ApiClientStatus,
    isFirstParty: row.isFirstParty,
    homepageUrl: row.homepageUrl,
    privacyUrl: row.privacyUrl,
    redirectUris: parseJsonArray(row.redirectUris),
    allowedScopes: parseJsonArray(row.allowedScopes),
    allowedChannels: parseJsonArray(row.allowedChannels) as ApiClientChannel[],
    rateLimitTier: row.rateLimitTier,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ApiClientRepositoryImpl implements ApiClientRepository {
  constructor(private readonly db: AppDatabase) {}

  async findByClientId(clientId: string): Promise<ApiClient | null> {
    const [row] = await this.db
      .select()
      .from(apiClients)
      .where(eq(apiClients.clientId, clientId))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async findById(id: string): Promise<ApiClient | null> {
    const [row] = await this.db.select().from(apiClients).where(eq(apiClients.id, id)).limit(1);
    return row ? toEntity(row) : null;
  }

  async list(filter: ApiClientListFilter): Promise<ApiClientListResult> {
    const limit = filter.limit;
    const conditions = [];
    if (filter.status) conditions.push(eq(apiClients.status, filter.status));
    if (filter.isFirstParty !== undefined) {
      conditions.push(eq(apiClients.isFirstParty, filter.isFirstParty));
    }
    if (filter.cursor) conditions.push(lt(apiClients.id, filter.cursor));

    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await this.db
      .select()
      .from(apiClients)
      .where(where)
      .orderBy(desc(apiClients.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: slice.map(toEntity),
      nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
      hasMore,
    };
  }

  async create(input: CreateApiClientInput): Promise<ApiClient> {
    const existing = await this.findByClientId(input.clientId);
    if (existing) {
      throw new ConflictError('CLIENT_ID_EXISTS', 'client_id sudah dipakai');
    }

    const id = generateId();
    const now = new Date();
    await this.db.insert(apiClients).values({
      id,
      clientId: input.clientId,
      clientSecretHash: null,
      name: input.name,
      description: input.description ?? null,
      ownerUserId: input.ownerUserId ?? null,
      status: input.status ?? 'pending',
      isFirstParty: false,
      homepageUrl: input.homepageUrl ?? null,
      privacyUrl: input.privacyUrl ?? null,
      redirectUris: JSON.stringify(input.redirectUris ?? []),
      allowedScopes: JSON.stringify(input.allowedScopes),
      allowedChannels: JSON.stringify(input.allowedChannels),
      rateLimitTier: input.rateLimitTier ?? 'standard',
      createdAt: now,
      updatedAt: null,
    });

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('CLIENT_NOT_FOUND', 'Klien gagal dibuat');
    return created;
  }

  async update(id: string, input: UpdateApiClientInput): Promise<ApiClient> {
    const current = await this.findById(id);
    if (!current) throw new NotFoundError('CLIENT_NOT_FOUND', 'Klien tidak ditemukan');

    const patch: Partial<typeof apiClients.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.homepageUrl !== undefined) patch.homepageUrl = input.homepageUrl;
    if (input.privacyUrl !== undefined) patch.privacyUrl = input.privacyUrl;
    if (input.redirectUris !== undefined) {
      patch.redirectUris = JSON.stringify(input.redirectUris);
    }
    if (input.allowedScopes !== undefined) {
      patch.allowedScopes = JSON.stringify(input.allowedScopes);
    }
    if (input.allowedChannels !== undefined) {
      patch.allowedChannels = JSON.stringify(input.allowedChannels);
    }
    if (input.rateLimitTier !== undefined) patch.rateLimitTier = input.rateLimitTier;

    await this.db.update(apiClients).set(patch).where(eq(apiClients.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('CLIENT_NOT_FOUND', 'Klien tidak ditemukan');
    return updated;
  }
}
