import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { MintVoiceTokenUseCase } from '../../application/mint-voice-token.use-case';

export class VoiceController {
  constructor(private readonly mintToken: MintVoiceTokenUseCase) {}

  mint(c: Context<{ Variables: AppVariables }>) {
    const user = c.get('user');
    if (!user?.user_id) {
      throw new UnauthorizedError();
    }
    return this.mintToken
      .execute(user.user_id)
      .then((data) => c.json({ success: true as const, data }, 200));
  }
}
