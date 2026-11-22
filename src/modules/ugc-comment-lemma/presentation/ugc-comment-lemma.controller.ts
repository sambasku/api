import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { CreateUgcCommentLemmaLinkUseCase } from '../application/use-cases/create-ugc-comment-lemma-link.use-case';
import type { DeleteUgcCommentLemmaLinkUseCase } from '../application/use-cases/delete-ugc-comment-lemma-link.use-case';
import type { UgcCommentAnchorKind } from '@/shared/database/drizzle/schema/ugc-comment-lemma-links.schema';
import { toUgcCommentLemmaLinkWire } from './ugc-comment-lemma-wire';
import type { CreateUgcCommentLemmaLinkBody } from './validators/ugc-comment-lemma.validator';

function requireUser(c: Context<{ Variables: AppVariables }>) {
  const user = c.get('user');
  if (!user?.user_id) {
    throw new UnauthorizedError('UNAUTHORIZED', 'Login dulu ya');
  }
  return user;
}

export class UgcCommentLemmaController {
  constructor(
    private readonly deps: {
      create: CreateUgcCommentLemmaLinkUseCase;
      delete: DeleteUgcCommentLemmaLinkUseCase;
    },
  ) {}

  async create(
    c: Context<{ Variables: AppVariables }>,
    input: {
      anchorKind: UgcCommentAnchorKind;
      hostId: string;
      commentId: string;
      body: CreateUgcCommentLemmaLinkBody;
    },
  ) {
    const user = requireUser(c);
    const row = await this.deps.create.execute({
      anchorKind: input.anchorKind,
      hostId: input.hostId,
      commentId: input.commentId,
      userId: user.user_id,
      start: input.body.start,
      end: input.body.end,
      wordId: input.body.word_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toUgcCommentLemmaLinkWire(row) }, 201);
  }

  async remove(
    c: Context<{ Variables: AppVariables }>,
    input: {
      anchorKind: UgcCommentAnchorKind;
      hostId: string;
      commentId: string;
      linkId: string;
    },
  ) {
    const user = requireUser(c);
    await this.deps.delete.execute({
      anchorKind: input.anchorKind,
      hostId: input.hostId,
      commentId: input.commentId,
      linkId: input.linkId,
      userId: user.user_id,
      isStaff: isVerifierRole(user.role ?? ''),
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: null });
  }
}