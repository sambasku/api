import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { JinyeComment, JinyeImage } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const MAX_BODY = 500;
const MAX_IMAGES = 4;

export interface CreateJinyeCommentCommand {
  jinyeId: string;
  userId: string;
  body?: string | null;
  parentId?: string | null;
  images?: JinyeImage[];
  requestId?: string | null;
}

export class CreateJinyeCommentUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: Pick<
      CommentBlocklistRepository,
      'listAllActiveWords'
    >,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'jinye_comment_created';
        actorId: string;
        targetId: string;
        dedupeKey: string;
      }) => Promise<void>;
    },
  ) {}

  async execute(cmd: CreateJinyeCommentCommand): Promise<JinyeComment> {
    await assertCanContribute(cmd.userId);

    const jinye = await this.repo.findById(cmd.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }

    let parentId: string | null = cmd.parentId?.trim() || null;
    if (parentId) {
      const parent = await this.repo.findCommentById(parentId);
      if (
        !parent ||
        parent.jinyeId !== cmd.jinyeId ||
        parent.status !== 'published'
      ) {
        throw new NotFoundError(
          'JINYE_COMMENT_NOT_FOUND',
          'Komentar induk tidak ditemukan',
        );
      }
      if (parent.parentId) {
        throw new ValidationError([
          {
            field: 'parent_id',
            message: 'Balasan hanya 1 tingkat. Balas ke komentar utama saja ya.',
          },
        ]);
      }
    }

    let body = (cmd.body ?? '').trim();
    if (body.length > MAX_BODY) {
      throw new ValidationError([
        { field: 'body', message: `Teks maksimal ${MAX_BODY} karakter` },
      ]);
    }

    const images = (cmd.images ?? []).slice(0, MAX_IMAGES);
    if ((cmd.images?.length ?? 0) > MAX_IMAGES) {
      throw new ValidationError([
        { field: 'images', message: 'Lampiran tidak boleh lebih dari 4 foto' },
      ]);
    }
    for (const img of images) {
      if (!/^https?:\/\//i.test(img.url) || !img.providerFileId.trim()) {
        throw new ValidationError([
          {
            field: 'images',
            message: 'Foto tidak valid. Unggah ulang dari aplikasi ya.',
          },
        ]);
      }
    }

    if (!body && images.length === 0) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Isi teks atau foto dulu ya.',
        },
      ]);
    }

    let bodyOriginal: string | null = null;
    if (body) {
      const quality = await assertUgcTextQualityWithStrike(body, {
        userId: cmd.userId,
        abuse: this.abuse,
        entityType: 'jinye_comment',
        requestId: cmd.requestId,
        field: 'body',
        minMeaningfulChars: 1,
      });
      const blocked = await this.blocklistRepo.listAllActiveWords();
      const filtered = applyBlocklistFilter(quality, blocked);
      if (filtered !== quality) {
        bodyOriginal = quality;
      }
      body = filtered;
    }

    const created = await this.repo.createComment({
      jinyeId: cmd.jinyeId,
      parentId,
      userId: cmd.userId,
      body,
      bodyOriginal,
      images: images.map((i) => ({
        url: i.url.trim(),
        providerFileId: i.providerFileId.trim(),
        publicUrl: null,
        contentWarnings: [],
      })),
    });

    await this.repo.incrementPublishedCommentCount(cmd.jinyeId, 1);

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'jinye_comment',
      entityId: created.id,
      newData: {
        jinye_id: cmd.jinyeId,
        parent_id: parentId,
        has_images: created.images.length > 0,
      },
      requestId: cmd.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_comment_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `jinye_comment:${created.id}`,
    });

    return created;
  }
}
