import type { PublicImageStoragePort } from '../ports/public-image-storage.port';
import {
  buildCampaignImagePath,
  buildCulinaryImagePath,
  buildEncyclopediaImagePath,
  buildEventImagePath,
  buildLayananImagePath,
  buildPlaceImagePath,
  buildUsahaImagePath,
  buildWordImagePath,
} from '../utils/public-image-path';
import { validateImageFile } from '../utils/validate-image-file';

export type PublicImagePurpose =
  | 'word'
  | 'campaign'
  | 'place'
  | 'event'
  | 'usaha'
  | 'culinary'
  | 'encyclopedia'
  | 'layanan';

export interface UploadPublicImageResult {
  url: string;
  provider: string;
  providerFileId: string;
  sha: string;
}

function pathForPurpose(purpose: PublicImagePurpose, mimeType: string): string {
  switch (purpose) {
    case 'campaign':
      return buildCampaignImagePath(mimeType);
    case 'place':
      return buildPlaceImagePath(mimeType);
    case 'event':
      return buildEventImagePath(mimeType);
    case 'usaha':
      return buildUsahaImagePath(mimeType);
    case 'culinary':
      return buildCulinaryImagePath(mimeType);
    case 'encyclopedia':
      return buildEncyclopediaImagePath(mimeType);
    case 'layanan':
      return buildLayananImagePath(mimeType);
    case 'word':
    default:
      return buildWordImagePath(mimeType);
  }
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
    const path = pathForPurpose(purpose, file.mimeType);
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
