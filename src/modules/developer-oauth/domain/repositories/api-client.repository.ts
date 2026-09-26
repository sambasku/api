import type {
  ApiClient,
  ApiClientChannel,
  ApiClientStatus,
} from '../entities/api-client.entity';

export interface ApiClientListFilter {
  status?: ApiClientStatus;
  isFirstParty?: boolean;
  limit: number;
  cursor?: string;
}

export interface ApiClientListResult {
  items: ApiClient[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateApiClientInput {
  clientId: string;
  name: string;
  description?: string | null;
  ownerUserId?: string | null;
  status?: ApiClientStatus;
  homepageUrl?: string | null;
  privacyUrl?: string | null;
  redirectUris?: string[];
  allowedScopes: string[];
  allowedChannels: ApiClientChannel[];
  rateLimitTier?: string;
}

export interface UpdateApiClientInput {
  name?: string;
  description?: string | null;
  status?: ApiClientStatus;
  homepageUrl?: string | null;
  privacyUrl?: string | null;
  redirectUris?: string[];
  allowedScopes?: string[];
  allowedChannels?: ApiClientChannel[];
  rateLimitTier?: string;
}

export interface ApiClientRepository {
  findByClientId(clientId: string): Promise<ApiClient | null>;
  findById(id: string): Promise<ApiClient | null>;
  list(filter: ApiClientListFilter): Promise<ApiClientListResult>;
  create(input: CreateApiClientInput): Promise<ApiClient>;
  update(id: string, input: UpdateApiClientInput): Promise<ApiClient>;
}
