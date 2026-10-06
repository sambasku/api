import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { buildDiscussionImagePath } from '@/modules/public-image/application/utils/public-image-path';
import { validateImageFile } from '@/modules/public-image/application/utils/validate-image-file';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type {
  Discussion,
  DiscussionImage,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface ApproveDiscussionCommand {
  id: string;
  actorId: string;
  /** Bytes tersensor per indeks gambar (opsional). Jika kosong, fetch dari ImageKit. */
  censoredFiles?: Uint8Array[];
  /** MIME per file (sejajar censoredFiles); fallback deteksi magic. */
  censoredMimeTypes?: (string | null)[];
  /**
   * Peringatan visual per indeks (panjang harus = jumlah gambar bila diisi).
   * Null/undefined → semua `[]`.
   */
  imageContentWarnings?: string[][] | null;
  requestId?: string | null;
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new ValidationError([
      { field: 'images', message: 'Gagal mengunduh gambar staging untuk dipromosikan' },
    ]);
  }
  const buf = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    mimeType: res.headers.get('content-type'),
  };
}

/** Validasi & normalisasi content_warnings sejajar jumlah gambar. */
export function normalizeApproveImageContentWarnings(
  raw: string[][] | null | undefined,
  imageCount: number,
): string[][] {
  if (imageCount === 0) {
    if (raw != null && raw.length > 0) {
      throw new ValidationError([
        {
          field: 'content_warnings',
          message: 'content_warnings tidak boleh diisi jika tidak ada gambar',
        },
      ]);
    }
    return [];
  }
  if (raw == null) {
    return Array.from({ length: imageCount }, () => []);
  }
  if (raw.length !== imageCount) {
    throw new ValidationError([
      {
        field: 'content_warnings',
        message: `content_warnings harus memiliki ${imageCount} entri (satu per gambar)`,
      },
    ]);
  }
  return raw.map((slot, index) => {
    if (!Array.isArray(slot)) {
      throw new ValidationError([
        {
          field: `content_warnings[${index}]`,
          message: 'Setiap entri content_warnings harus berupa array',
        },
      ]);
    }
    const out: string[] = [];
    for (const w of slot) {
      if (typeof w !== 'string' || !IMAGE_CONTENT_WARNING_SET.has(w)) {
        throw new ValidationError([
          {
            field: `content_warnings[${index}]`,
            message: 'Nilai content_warnings tidak dikenal',
          },
        ]);
      }
      if (!out.includes(w)) out.push(w);
    }
    return out;
  });
}

export class ApproveDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly imageStorage: ImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly activityEvents?: { safe: (cmd: { kind: 'discussion_created'; actorId: string; targetId: string; dedupeKey: string }) => Promise<void> },
  ) {}

  async execute(cmd: ApproveDiscussionCommand): Promise<Discussion> {
    const existing = await this.repo.findById(cmd.id);
    if (!existing || existing.status !== 'pending_review') {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    const warningsByIndex = normalizeApproveImageContentWarnings(
      cmd.imageContentWarnings,
      existing.images.length,
    );

    let nextImages: DiscussionImage[] = existing.images.map((img, i) => ({
      ...img,
      contentWarnings: warningsByIndex[i] ?? [],
    }));

    if (existing.images.length > 0) {
      const promoted: DiscussionImage[] = [];
      for (let i = 0; i < existing.images.length; i++) {
        const staging = existing.images[i];
        const provided = cmd.censoredFiles?.[i];
        let bytes: Uint8Array;
        let mimeHint: string | null;

        if (provided && provided.byteLength > 0) {
          bytes = provided;
          mimeHint = cmd.censoredMimeTypes?.[i] ?? null;
        } else {
          const fetched = await fetchImageBytes(staging.url);
          bytes = fetched.bytes;
          mimeHint = fetched.mimeType;
        }

        const file = validateImageFile({ bytes, mimeType: mimeHint });
        const path = buildDiscussionImagePath(file.mimeType);
        const uploaded = await this.publicImageStorage.upload({
          path,
          content: file.bytes,
          mimeType: file.mimeType,
        });

        promoted.push({
          url: staging.url,
          providerFileId: staging.providerFileId,
          publicUrl: uploaded.url,
          contentWarnings: warningsByIndex[i] ?? [],
        });
      }
      nextImages = promoted;

      for (const img of existing.images) {
        // deleteFile ImageKit sudah best-effort (log internal, tidak lempar)
        await this.imageStorage.deleteFile(img.providerFileId);
      }
    }

    const updated = await this.repo.updateStatus({
      id: existing.id,
      fromStatus: 'pending_review',
      toStatus: 'published',
      actorId: cmd.actorId,
      images: nextImages,
      rejectionNote: null,
    });
    if (!updated) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }

    // Event feed: diskusi tayang. Actor = pembuat diskusi (existing.userId).
    await this.activityEvents?.safe({
      kind: 'discussion_created',
      actorId: existing.userId,
      targetId: existing.id,
      dedupeKey: `discussion:${existing.id}`,
    });

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'discussion',
      entityId: updated.id,
      oldData: { status: existing.status },
      newData: {
        status: updated.status,
        image_count: nextImages.length,
        promoted: nextImages.some((i) => i.publicUrl != null),
        content_warnings: nextImages.map((i) => i.contentWarnings),
      },
      requestId: cmd.requestId ?? null,
    });

    await this.inbox?.execute({
      userId: existing.userId,
      type: 'discussion_approved',
      targetKind: 'discussion',
      targetId: updated.id,
      actorId: cmd.actorId,
    });

    return updated;
  }
}
