import { NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';
import {
  clampDurationMs,
  validateAudioFile,
} from '@/modules/word/application/utils/validate-audio-file';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { buildEntityCommentAudioPath } from '@/shared/comment/build-entity-comment-audio-path';
import { prepareEntityCommentAudioCaption } from '@/shared/comment/prepare-entity-comment-create';
import type { ArticleComment } from '../../domain/entities/encyclopedia.entity';
import type { ArticleRepository } from '../../domain/repositories/encyclopedia.repository';

export interface CreateArticleCommentAudioCommand {
  articleId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string | null | undefined;
  filename?: string | null;
  body?: string | null;
  durationMs?: unknown;
  requestId?: string | null;
}

export class CreateArticleCommentAudioUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly storage: PronunciationStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: CreateArticleCommentAudioCommand): Promise<ArticleComment> {
    await assertCanContribute(cmd.userId);
    const article = await this.repo.findById(cmd.articleId);
    if (!article || article.status !== 'published') {
      throw new NotFoundError(
        'ARTICLE_NOT_FOUND',
        'Artikel tidak ditemukan atau sudah tidak tayang',
      );
    }

    const { body, bodyOriginal } = await prepareEntityCommentAudioCaption({
      userId: cmd.userId,
      requestId: cmd.requestId,
      entityType: 'article_comment',
      body: cmd.body,
      blocklistRepo: this.blocklistRepo,
      abuse: this.abuse,
    });

    const file = validateAudioFile({
      bytes: cmd.bytes,
      mimeType: cmd.mimeType,
      filename: cmd.filename,
    });
    const durationMs = clampDurationMs(cmd.durationMs);
    const path = buildEntityCommentAudioPath({
      kind: 'articles',
      parentId: cmd.articleId,
      mimeType: file.mimeType,
    });
    const uploaded = await this.storage.upload({
      path,
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const created = await this.repo.createComment({
      articleId: cmd.articleId,
      userId: cmd.userId,
      body,
      bodyOriginal,
      audio: {
        url: uploaded.url,
        mimeType: file.mimeType,
        fileSize: uploaded.size,
        durationMs,
        provider: this.storage.providerName,
        providerFileId: uploaded.path,
        sha: uploaded.sha,
      },
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'article_comment',
      entityId: created.id,
      newData: { article_id: cmd.articleId, has_audio: true },
      requestId: cmd.requestId ?? null,
    });
    await this.activityEvents?.safe({
      kind: 'article_comment_created',
      actorId: cmd.userId,
      targetId: created.id,
      dedupeKey: `article_comment:${created.id}`,
    });
    return created;
  }
}