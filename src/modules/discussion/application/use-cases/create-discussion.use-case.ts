import { ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type {
  NewDiscussion,
  Discussion,
  DiscussionImage,
} from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface CreateDiscussionCommand {
  userId: string;
  body?: string | null;
  images: DiscussionImage[];
  requestId?: string | null;
}

export class CreateDiscussionUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: CreateDiscussionCommand): Promise<Discussion> {
    const trimmed = cmd.body?.trim() ? cmd.body.trim() : null;

    if (trimmed !== null) {
      if (trimmed.length < 1) {
        throw new ValidationError([{ field: 'body', message: 'Isi teks minimal 1 karakter' }]);
      }
      if (trimmed.length > 1000) {
        throw new ValidationError([{ field: 'body', message: 'Isi teks maksimal 1000 karakter' }]);
      }
    }

    if (cmd.images.length > 4) {
      throw new ValidationError([
        { field: 'images', message: 'Lampiran tidak boleh lebih dari 4 gambar' },
      ]);
    }

    if (!trimmed && cmd.images.length < 1) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Isi teks atau unggah minimal 1 gambar',
        },
      ]);
    }

    for (const img of cmd.images) {
      if (!/^https?:\/\//i.test(img.url)) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
      if (!img.providerFileId.trim()) {
        throw new ValidationError([{ field: 'images', message: 'Alamat gambar tidak valid' }]);
      }
    }

    const input: NewDiscussion = {
      userId: cmd.userId,
      body: trimmed,
      images: cmd.images.map((img) => ({
        url: img.url,
        providerFileId: img.providerFileId,
        publicUrl: null,
      })),
    };
    const row = await this.repo.create(input);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'discussion',
      entityId: row.id,
      newData: {
        status: row.status,
        image_count: cmd.images.length,
        has_body: trimmed != null,
      },
      requestId: cmd.requestId ?? null,
    });

    return row;
  }
}
