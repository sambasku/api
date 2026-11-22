import type { PublicProfileActivityFilter } from '../../domain/entities/public-profile.entity';

/** Query GET /users/:username/activity (mode terfilter = cursor keyset). */
export interface PublicActivityQueryInput {
  kind?: PublicProfileActivityFilter;
  limit: number;
  cursor?: string;
}
