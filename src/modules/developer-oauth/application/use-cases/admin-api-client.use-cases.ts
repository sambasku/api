import { BadRequestError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  FIRST_PARTY_SCOPES,
  type ApiClient,
  type ApiClientChannel,
  type ApiClientStatus,
} from '../../domain/entities/api-client.entity';
import type {
  ApiClientRepository,
  CreateApiClientInput,
  UpdateApiClientInput,
} from '../../domain/repositories/api-client.repository';

const ALLOWED_SCOPES = new Set<string>(FIRST_PARTY_SCOPES);
const STATUSES = new Set<ApiClientStatus>(['pending', 'approved', 'suspended', 'revoked']);
const CHANNELS = new Set<ApiClientChannel>(['web', 'mobile']);

/** client_id publik: lowercase, angka, hyphen; 3-64 karakter. */
const CLIENT_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

function assertScopes(scopes: string[]) {
  if (!scopes.length) {
    throw new BadRequestError('VALIDATION_ERROR', 'allowed_scopes wajib diisi', [
      { field: 'allowed_scopes', message: 'Minimal satu scope' },
    ]);
  }
  for (const s of scopes) {
    if (!ALLOWED_SCOPES.has(s)) {
      throw new BadRequestError('VALIDATION_ERROR', `Scope tidak dikenal: ${s}`, [
        { field: 'allowed_scopes', message: `Scope ${s} tidak diizinkan` },
      ]);
    }
  }
}

function assertChannels(channels: ApiClientChannel[]) {
  if (!channels.length) {
    throw new BadRequestError('VALIDATION_ERROR', 'allowed_channels wajib diisi', [
      { field: 'allowed_channels', message: 'Minimal satu channel' },
    ]);
  }
  for (const ch of channels) {
    if (!CHANNELS.has(ch)) {
      throw new BadRequestError('VALIDATION_ERROR', `Channel tidak valid: ${ch}`, [
        { field: 'allowed_channels', message: 'Channel harus web atau mobile' },
      ]);
    }
  }
}

function assertStatus(status: ApiClientStatus) {
  if (!STATUSES.has(status)) {
    throw new BadRequestError('VALIDATION_ERROR', `Status tidak valid: ${status}`, [
      { field: 'status', message: 'Status tidak valid' },
    ]);
  }
}

function mapAdmin(client: ApiClient) {
  return {
    id: client.id,
    client_id: client.clientId,
    name: client.name,
    description: client.description,
    owner_user_id: client.ownerUserId,
    status: client.status,
    is_first_party: client.isFirstParty,
    homepage_url: client.homepageUrl,
    privacy_url: client.privacyUrl,
    redirect_uris: client.redirectUris,
    allowed_scopes: client.allowedScopes,
    allowed_channels: client.allowedChannels,
    rate_limit_tier: client.rateLimitTier,
    created_at: client.createdAt.toISOString(),
    updated_at: client.updatedAt?.toISOString() ?? null,
  };
}

export class ListAdminApiClientsUseCase {
  constructor(private readonly repo: ApiClientRepository) {}

  async execute(opts: {
    status?: ApiClientStatus;
    isFirstParty?: boolean;
    limit: number;
    cursor?: string;
  }) {
    const result = await this.repo.list(opts);
    return {
      items: result.items.map(mapAdmin),
      next_cursor: result.nextCursor,
      has_more: result.hasMore,
    };
  }
}

export class GetAdminApiClientUseCase {
  constructor(private readonly repo: ApiClientRepository) {}

  async execute(id: string) {
    const client = await this.repo.findById(id);
    if (!client) throw new NotFoundError('CLIENT_NOT_FOUND', 'Klien tidak ditemukan');
    return mapAdmin(client);
  }
}

export class CreateAdminApiClientUseCase {
  constructor(
    private readonly repo: ApiClientRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    clientId: string;
    name: string;
    description?: string | null;
    status?: ApiClientStatus;
    homepageUrl?: string | null;
    privacyUrl?: string | null;
    redirectUris?: string[];
    allowedScopes: string[];
    allowedChannels: ApiClientChannel[];
    rateLimitTier?: string;
    actorId: string;
    requestId?: string | null;
  }) {
    const clientId = input.clientId.trim().toLowerCase();
    if (!CLIENT_ID_RE.test(clientId)) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'client_id harus 3-64 karakter: huruf kecil, angka, hyphen',
        [{ field: 'client_id', message: 'Format client_id tidak valid' }],
      );
    }
    if (clientId.startsWith('sambasku-')) {
      throw new BadRequestError(
        'VALIDATION_ERROR',
        'Prefix sambasku- dicadangkan untuk first-party',
        [{ field: 'client_id', message: 'Prefix sambasku- tidak diizinkan' }],
      );
    }
    if (!input.name.trim()) {
      throw new BadRequestError('VALIDATION_ERROR', 'Nama wajib diisi', [
        { field: 'name', message: 'Nama wajib diisi' },
      ]);
    }

    assertScopes(input.allowedScopes);
    assertChannels(input.allowedChannels);
    if (input.status) assertStatus(input.status);

    const created = await this.repo.create({
      clientId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? 'pending',
      homepageUrl: input.homepageUrl?.trim() || null,
      privacyUrl: input.privacyUrl?.trim() || null,
      redirectUris: input.redirectUris ?? [],
      allowedScopes: input.allowedScopes,
      allowedChannels: input.allowedChannels,
      rateLimitTier: input.rateLimitTier ?? 'standard',
    } satisfies CreateApiClientInput);

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'create',
      entityType: 'api_client',
      entityId: created.id,
      newData: {
        client_id: created.clientId,
        status: created.status,
        allowed_scopes: created.allowedScopes,
      },
      requestId: input.requestId ?? null,
    });

    return mapAdmin(created);
  }
}

export class UpdateAdminApiClientUseCase {
  constructor(
    private readonly repo: ApiClientRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    id: string;
    patch: UpdateApiClientInput;
    actorId: string;
    requestId?: string | null;
  }) {
    const current = await this.repo.findById(input.id);
    if (!current) throw new NotFoundError('CLIENT_NOT_FOUND', 'Klien tidak ditemukan');

    if (input.patch.status) {
      assertStatus(input.patch.status);
      if (current.isFirstParty && input.patch.status === 'revoked') {
        throw new BadRequestError(
          'VALIDATION_ERROR',
          'Klien first-party tidak boleh di-revoke',
          [{ field: 'status', message: 'Gunakan suspended untuk first-party' }],
        );
      }
    }
    if (input.patch.allowedScopes) assertScopes(input.patch.allowedScopes);
    if (input.patch.allowedChannels) assertChannels(input.patch.allowedChannels);
    if (input.patch.name !== undefined && !input.patch.name.trim()) {
      throw new BadRequestError('VALIDATION_ERROR', 'Nama wajib diisi', [
        { field: 'name', message: 'Nama wajib diisi' },
      ]);
    }

    const updated = await this.repo.update(input.id, {
      ...input.patch,
      name: input.patch.name?.trim(),
      description:
        input.patch.description === undefined
          ? undefined
          : input.patch.description?.trim() || null,
      homepageUrl:
        input.patch.homepageUrl === undefined
          ? undefined
          : input.patch.homepageUrl?.trim() || null,
      privacyUrl:
        input.patch.privacyUrl === undefined
          ? undefined
          : input.patch.privacyUrl?.trim() || null,
    });

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'update',
      entityType: 'api_client',
      entityId: updated.id,
      oldData: {
        status: current.status,
        allowed_scopes: current.allowedScopes,
        name: current.name,
      },
      newData: {
        status: updated.status,
        allowed_scopes: updated.allowedScopes,
        name: updated.name,
      },
      requestId: input.requestId ?? null,
    });

    return mapAdmin(updated);
  }
}
