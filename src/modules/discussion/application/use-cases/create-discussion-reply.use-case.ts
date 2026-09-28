import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import { applyBlocklistFilter } from '@/modules/comment-blocklist/application/utils/apply-blocklist-filter';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';

export interface CreateDiscussionReplyCommand {
  discussionId: string;
  userId: string;
  body: string;
  requestId?: string | null;
}

export class CreateDiscussionReplyUseCase {
  constructor(
    private readonly repo: DiscussionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly blocklistRepo: CommentBlocklistRepository,
  ) {}

  async execute(cmd: CreateDiscussionReplyCommand): Promise<DiscussionReply> {
    const body = cmd.body.trim();
    if (body.length < 1) {
      throw new ValidationError([{ field: 'body', message: 'Balasan minimal 1 karakter' }]);
    }
    if (body.length > 500) {
      throw new ValidationError([{ field: 'body', message: 'Balasan maksimal 500 karakter' }]);
    }

    const help = await this.repo.findById(cmd.discussionId);
    if (!help) {
      throw new NotFoundError('DISCUSSION_NOT_FOUND', 'Diskusi tidak ditemukan');
    }
    if (help.status !== 'published') {
      throw new ConflictError(
        'DISCUSSION_NOT_PUBLISHED',
        'Balasan hanya bisa ditambahkan pada diskusi yang sudah tayang',
      );
    }

    const blocked = await this.blocklistRepo.listAllActiveWords();
    const filteredBody = applyBlocklistFilter(body, blocked);
    const wasFiltered = filteredBody !== body;

    const reply = await this.repo.createReply({
      discussionId: cmd.discussionId,
      userId: cmd.userId,
      body: filteredBody,
      bodyOriginal: wasFiltered ? body : null,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'discussion_reply',
      entityId: reply.id,
      newData: {
        discussion_id: cmd.discussionId,
        status: 'published',
        censored: wasFiltered,
      },
      requestId: cmd.requestId ?? null,
    });

    return (await this.repo.findReplyById(reply.id)) ?? reply;
  }
}
