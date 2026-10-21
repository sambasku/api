import { ForbiddenError } from '@/shared/errors/app-error';
import type {
  SocialScreenshot,
  VerifierApplication,
} from '../../domain/entities/verifier-application.entity';
import type { VerifierApplicationRepository } from '../../domain/repositories/verifier-application.repository';

export interface UpdateVerifierScreenshotCommand {
  applicationId: string;
  index: number;
  actorRoles: string[];
  screenshot: SocialScreenshot;
}

/** Admin/root mengganti screenshot akun sosial pengajuan yang masih pending. */
export class UpdateVerifierApplicationScreenshotUseCase {
  constructor(private readonly appRepo: VerifierApplicationRepository) {}

  async execute(cmd: UpdateVerifierScreenshotCommand): Promise<VerifierApplication> {
    if (!cmd.actorRoles.includes('root') && !cmd.actorRoles.includes('admin')) {
      throw new ForbiddenError('FORBIDDEN', 'Hanya admin dan root yang bisa mengubah screenshot pengajuan');
    }
    return this.appRepo.updateSocialScreenshot(cmd.applicationId, cmd.index, {
      url: cmd.screenshot.url,
      provider_file_id: cmd.screenshot.provider_file_id,
    });
  }
}
