import type { PublicActivityKind } from '../../domain/entities/public-profile.entity';

/** Query GET /users/:username/activity (mode terfilter = cursor keyset). */
export interface PublicActivityQueryInput {
  kind?: PublicActivityKind;
  limit: number;
  cursor?: string;
}
