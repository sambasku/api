import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { buildWordImagePath } from '@/modules/public-image/application/utils/public-image-path';
import { validateImageFile } from '@/modules/public-image/application/utils/validate-image-file';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { resolveChildPublication } from '@/modules/word/application/utils/resolve-publication';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import type { ImageContentWarning } from '@/shared/constants/image-content-warnings';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type {
  JinyeImage,
  JinyePromoteImageResult,
} from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';
import { isTrustedJinyeImage } from '../utils/jinye-image-trust';
import { fetchImageBytesLimited } from '../utils/migrate-jinye-images';

const MAX_IMAGES = 4;

/**
 * User login mengajukan foto Jinye (published) jadi foto lemma.
 *
 * - Foto DISALIN ke `assets/words/` (file lemma mandiri; takedown/arsip Jinye
 *   tidak merusak foto lemma dan sebaliknya).
 * - User biasa: published + belum verified (antrean review, publik lihat
 *   placeholder). Verifikator: langsung verified.
 * - Atribusi: `word_images.source_type=jinye`, `source_reference=<jinyeId>:<fileId>`.
 * - All-or-nothing: gagal di tengah = file GitHub baru dan baris yang sudah
 *   masuk dibatalkan.
 */
export class PromoteJinyeImageUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly words: Pick<
      WordRepository,
      | 'findById'
      | 'findWordImageBySource'
      | 'addWordImage'
      | 'softDeleteWordImages'
    >,
    private readonly storage: PublicImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly imageKitEndpoint?: string,
    private readonly fetchBytes: typeof fetchImageBytesLimited = fetchImageBytesLimited,
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    role: string | string[];
    wordId: string;
    /** `public_url` foto Jinye yang dipilih (stabil, bukan index). */
    imageUrls: string[];
    requestId?: string | null;
  }): Promise<JinyePromoteImageResult> {
    await assertCanContribute(input.userId);

    const urls = [...new Set(input.imageUrls.map((u) => u.trim()).filter(Boolean))];
    if (urls.length === 0 || urls.length > MAX_IMAGES) {
      throw new ValidationError([
        { field: 'image_urls', message: 'Pilih 1 sampai 4 foto dari Jinye ini.' },
      ]);
    }

    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    const word = await this.words.findById(input.wordId);
    if (
      !word ||
      word.status !== 'published' ||
      !word.isVerified ||
      word.deletedAt
    ) {
      throw new ValidationError([
        {
          field: 'word_id',
          message: 'Pilih kata yang sudah tayang dan terverifikasi ya.',
        },
      ]);
    }

    const picked: { image: JinyeImage; sourceUrl: string; ref: string }[] = [];
    for (const url of urls) {
      const image = jinye.images.find((i) => (i.publicUrl ?? i.url) === url);
      if (!image) {
        throw new ValidationError([
          { field: 'image_urls', message: 'Foto tidak ditemukan di Jinye ini.' },
        ]);
      }
      if (
        !isTrustedJinyeImage(
          { url, providerFileId: image.providerFileId },
          this.imageKitEndpoint,
        )
      ) {
        throw new ValidationError([
          { field: 'image_urls', message: 'Foto tidak valid untuk dijadikan foto lemma.' },
        ]);
      }
      const ref = `${jinye.id}:${image.providerFileId}`;
      const existing = await this.words.findWordImageBySource(word.id, 'jinye', ref);
      if (existing) {
        throw new ConflictError(
          'JINYE_IMAGE_ALREADY_PROMOTED',
          'Foto ini sudah diajukan untuk kata tersebut.',
        );
      }
      picked.push({ image, sourceUrl: url, ref });
    }

    const publication = resolveChildPublication(input.role);
    const uploaded: { path: string; sha: string }[] = [];
    const insertedIds: string[] = [];
    const results: JinyePromoteImageResult['images'] = [];

    try {
      for (const p of picked) {
        const fetched = await this.fetchBytes(p.sourceUrl);
        const file = validateImageFile({
          bytes: fetched.bytes,
          mimeType: fetched.mimeType,
        });
        const stored = await this.storage.upload({
          path: buildWordImagePath(file.mimeType),
          content: file.bytes,
          mimeType: file.mimeType,
        });
        uploaded.push({ path: stored.path, sha: stored.sha });

        const media = await this.words.addWordImage(
          word.id,
          {
            url: stored.url,
            providerFileId: stored.path,
            provider: this.storage.providerName,
            sha: stored.sha,
            altText: null,
            isPrimary: false,
            contentWarnings: p.image.contentWarnings.filter(
              (w): w is ImageContentWarning => IMAGE_CONTENT_WARNING_SET.has(w),
            ),
            attribution: null,
            // Sengaja bukan resolveWordImageVerified: github dianggap auto-verified,
            // padahal foto user biasa wajib lewat review.
            status: publication.status,
            isVerified: publication.isVerified,
            sourceType: 'jinye',
            sourceReference: p.ref,
          },
          input.userId,
        );
        insertedIds.push(media.id);
        results.push({
          id: media.id,
          url: media.url,
          status: media.status,
          isVerified: media.isVerified,
        });
      }
    } catch (err) {
      if (insertedIds.length > 0) {
        await this.words.softDeleteWordImages(insertedIds).catch(() => undefined);
      }
      for (const f of uploaded) {
        await this.storage.delete(f.path, f.sha);
      }
      throw err;
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'word_image',
      entityId: results[0].id,
      newData: {
        source: 'jinye',
        jinye_id: jinye.id,
        word_id: word.id,
        word_image_ids: results.map((r) => r.id),
        status: results[0].status,
      },
      requestId: input.requestId ?? null,
    });

    return { images: results };
  }
}
