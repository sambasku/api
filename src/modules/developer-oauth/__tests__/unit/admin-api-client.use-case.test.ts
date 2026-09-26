import { describe, expect, it, vi } from 'vitest';
import {
  CreateAdminApiClientUseCase,
  UpdateAdminApiClientUseCase,
} from '../../application/use-cases/admin-api-client.use-cases';
import type { ApiClientRepository } from '../../domain/repositories/api-client.repository';
import type { ApiClient } from '../../domain/entities/api-client.entity';
import { FIRST_PARTY_SCOPE_STRING } from '../../domain/entities/api-client.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

function client(partial: Partial<ApiClient> & Pick<ApiClient, 'clientId' | 'id'>): ApiClient {
  return {
    clientSecretHash: null,
    name: 'Test',
    description: null,
    ownerUserId: null,
    status: 'approved',
    isFirstParty: false,
    homepageUrl: null,
    privacyUrl: null,
    redirectUris: [],
    allowedScopes: ['vote.write'],
    allowedChannels: ['web'],
    rateLimitTier: 'standard',
    createdAt: new Date(),
    updatedAt: null,
    ...partial,
  };
}

describe('CreateAdminApiClientUseCase', () => {
  const audit: AuditLogRepository = { record: vi.fn(), list: vi.fn() };

  it('tolak prefix sambasku-', async () => {
    const repo = {
      create: vi.fn(),
    } as unknown as ApiClientRepository;
    const uc = new CreateAdminApiClientUseCase(repo, audit);
    await expect(
      uc.execute({
        clientId: 'sambasku-evil',
        name: 'Evil',
        allowedScopes: ['vote.write'],
        allowedChannels: ['web'],
        actorId: 'admin1',
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('buat klien third-party', async () => {
    const created = client({ id: '01CLIENTTEST000000000001', clientId: 'partner-app' });
    const repo = {
      create: vi.fn().mockResolvedValue(created),
    } as unknown as ApiClientRepository;
    const uc = new CreateAdminApiClientUseCase(repo, audit);
    const result = await uc.execute({
      clientId: 'Partner-App',
      name: 'Partner',
      allowedScopes: ['vote.write', 'comment.write'],
      allowedChannels: ['web', 'mobile'],
      actorId: 'admin1',
    });
    expect(result.client_id).toBe('partner-app');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'partner-app', status: 'pending' }),
    );
  });
});

describe('UpdateAdminApiClientUseCase', () => {
  const audit: AuditLogRepository = { record: vi.fn(), list: vi.fn() };

  it('tolak revoke first-party', async () => {
    const current = client({
      id: '01APICLIENTWEB00000000001',
      clientId: 'sambasku-web',
      isFirstParty: true,
      allowedScopes: FIRST_PARTY_SCOPE_STRING.split(' '),
      allowedChannels: ['web'],
    });
    const repo = {
      findById: vi.fn().mockResolvedValue(current),
      update: vi.fn(),
    } as unknown as ApiClientRepository;
    const uc = new UpdateAdminApiClientUseCase(repo, audit);
    await expect(
      uc.execute({ id: current.id, patch: { status: 'revoked' }, actorId: 'admin1' }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('izinkan suspend first-party', async () => {
    const current = client({
      id: '01APICLIENTWEB00000000001',
      clientId: 'sambasku-web',
      isFirstParty: true,
      allowedScopes: FIRST_PARTY_SCOPE_STRING.split(' '),
      allowedChannels: ['web'],
    });
    const updated = { ...current, status: 'suspended' as const };
    const repo = {
      findById: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue(updated),
    } as unknown as ApiClientRepository;
    const uc = new UpdateAdminApiClientUseCase(repo, audit);
    const result = await uc.execute({
      id: current.id,
      patch: { status: 'suspended' },
      actorId: 'admin1',
    });
    expect(result.status).toBe('suspended');
  });
});
