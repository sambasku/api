import type { PublicImageStoragePort } from '../ports/public-image-storage.port';
import {
  buildCampaignImagePath,
  buildWordImagePath,
} from '../utils/public-image-path';
import { validateImageFile } from '../utils/validate-image-file';

export type PublicImagePurpose = 'word' | 'campaign';

export interface UploadPublicImageResult {
  url: string;
  provider: string;
  providerFileId: string;
  sha: string;
}

/** Upload gambar publik (GitHub). Avatar punya use-case sendiri. */
export class UploadPublicImageUseCase {
  constructor(private readonly storage: PublicImageStoragePort) {}

  async execute(input: {
    bytes: Uint8Array;
    mimeType: string | null | undefined;
    filename?: string | null;
    purpose?: PublicImagePurpose;
  }): Promise<UploadPublicImageResult> {
    const file = validateImageFile(input);
    const purpose = input.purpose ?? 'word';
    const path =
      purpose === 'campaign'
        ? buildCampaignImagePath(file.mimeType)
        : buildWordImagePath(file.mimeType);
    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });
    return {
      url: uploaded.url,
      provider: this.storage.providerName,
      providerFileId: uploaded.path,
      sha: uploaded.sha,
    };
  }
}
