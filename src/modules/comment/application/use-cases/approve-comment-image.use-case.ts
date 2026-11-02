import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { buildCommentImagePath } from '@/modules/public-image/application/utils/public-image-path';
import { validateImageFile } from '@/modules/public-image/application/utils/validate-image-file';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';

export interface ApproveCommentImageCommand {
  commentId: string;
  actorId: string;
  /** Bytes tersensor opsional; kosong = unduh staging. */
  censoredBytes?: Uint8Array | null;
  censoredMimeType?: string | null;
  contentWarnings?: string[] | null;
  requestId?: string | null;
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new ValidationError([
      { field: 'image', message: 'Gagal mengunduh gambar staging untuk dipromosikan' },
    ]);
  }
  const buf = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(buf),
    mimeType: res.headers.get('content-type'),
  };
}

function normalizeContentWarnings(raw: string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ValidationError([
      { field: 'content_warnings', message: 'content_warnings harus berupa array' },
    ]);
  }
  const out: string[] = [];
  for (const w of raw) {
    if (typeof w !== 'string' || !IMAGE_CONTENT_WARNING_SET.has(w)) {
      throw new ValidationError([
        { field: 'content_warnings', message: 'Nilai content_warnings tidak dikenal' },
      ]);
    }
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/** Approve foto komentar: staging ImageKit → GitHub publik. */
export class ApproveCommentImageUseCase {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly imageStorage: ImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
  ) {}

  async execute(cmd: ApproveCommentImageCommand): Promise<Comment> {
    const existing = await this.commentRepo.findById(cmd.commentId);
    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (!existing.image || existing.image.status !== 'pending_review') {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_PENDING',
        'Foto komentar tidak menunggu pengecekan',
      );
    }

    const warnings = normalizeContentWarnings(cmd.contentWarnings);
    const stagingFileId = existing.image.providerFileId;

    let bytes: Uint8Array;
    let mimeHint: string | null;
    if (cmd.censoredBytes && cmd.censoredBytes.byteLength > 0) {
      bytes = cmd.censoredBytes;
      mimeHint = cmd.censoredMimeType ?? null;
    } else {
      const fetched = await fetchImageBytes(existing.image.url);
      bytes = fetched.bytes;
      mimeHint = fetched.mimeType;
    }

    const file = validateImageFile({ bytes, mimeType: mimeHint });
    const path = buildCommentImagePath(file.mimeType);
    const uploaded = await this.publicImageStorage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const updated = await this.commentRepo.approveImage(cmd.commentId, {
      reviewerId: cmd.actorId,
      publicUrl: uploaded.url,
      provider: this.publicImageStorage.providerName,
      providerFileId: uploaded.path,
      contentWarnings: warnings,
    });
    if (!updated) {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_PENDING',
        'Foto komentar tidak menunggu pengecekan',
      );
    }

    await this.imageStorage.deleteFile(stagingFileId);

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'comment',
      entityId: updated.id,
      oldData: { image_status: 'pending_review' },
      newData: {
        image_status: 'published',
        image_public_url: uploaded.url,
        content_warnings: warnings,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.inbox?.execute({
      userId: existing.userId,
      type: 'comment_image_approved',
      targetKind: 'word',
      targetId: existing.wordId,
      actorId: cmd.actorId,
      title: 'Foto komentar disetujui',
      body: 'Fotomu di komentar sudah tayang.',
      actionKind: 'word',
      actionValue: existing.wordId,
    });

    return updated;
  }
}
