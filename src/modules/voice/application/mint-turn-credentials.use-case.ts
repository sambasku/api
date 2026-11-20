import { ServiceUnavailableError } from '@/shared/errors/app-error';
import { env } from '@/shared/config/env';
import {
  mintTurnCredentials,
  type MintTurnCredentialsResult,
} from '../infrastructure/mint-turn-credentials';

export type MintTurnCredentialsResultDto = MintTurnCredentialsResult;

export class MintTurnCredentialsUseCase {
  async execute(): Promise<MintTurnCredentialsResultDto> {
    const secret = env.TURN_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableError(
        'TURN_UNAVAILABLE',
        'TURN belum dikonfigurasi.',
      );
    }
    return mintTurnCredentials(secret);
  }
}
