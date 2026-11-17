import type { Context } from 'hono';
import type { z } from 'zod';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { KaryaLemmaLink } from '../../domain/karya';
import type { CreateKaryaLemmaLinkUseCase } from '../../application/use-cases/create-karya-lemma-link.use-case';
import type { DeleteKaryaLemmaLinkUseCase } from '../../application/use-cases/delete-karya-lemma-link.use-case';
import type { ListKaryaExcerptLemmaLinksUseCase } from '../../application/use-cases/list-karya-excerpt-lemma-links.use-case';
import type { ProposeKaryaLemmaCorrectionUseCase } from '../../application/use-cases/propose-karya-lemma-correction.use-case';
import type { ResolveKaryaLemmaCorrectionUseCase } from '../../application/use-cases/resolve-karya-lemma-correction.use-case';
import type {
  createKaryaLemmaLinkBodySchema,
  proposeKaryaLemmaCorrectionBodySchema,
  resolveKaryaLemmaCorrectionBodySchema,
} from './validators/karya-lemma-link.validator';

function requireUser(c: Context<{ Variables: AppVariables }>) {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

export function toKaryaLemmaLinkWire(link: KaryaLemmaLink) {
  return {
    id: link.id,
    excerpt_id: link.excerptId,
    start: link.start,
    end: link.end,
    word_id: link.wordId,
    lemma: link.lemma,
    status: link.status,
    source: link.source,
    proposed_word_id: link.proposedWordId,
    proposed_lemma: link.proposedLemma,
    proposed_by: link.proposedBy,
    created_at: link.createdAt.toISOString(),
  };
}

export class KaryaLemmaLinkController {
  constructor(
    private readonly deps: {
      listByExcerpt: ListKaryaExcerptLemmaLinksUseCase;
      create: CreateKaryaLemmaLinkUseCase;
      proposeCorrection: ProposeKaryaLemmaCorrectionUseCase;
      resolveCorrection: ResolveKaryaLemmaCorrectionUseCase;
      deleteLink: DeleteKaryaLemmaLinkUseCase;
    },
  ) {}

  async listByExcerpt(c: Context<{ Variables: AppVariables }>, excerptId: string) {
    const items = await this.deps.listByExcerpt.execute(excerptId);
    return c.json({ success: true as const, data: items.map(toKaryaLemmaLinkWire) });
  }

  async create(
    c: Context<{ Variables: AppVariables }>,
    excerptId: string,
    body: z.infer<typeof createKaryaLemmaLinkBodySchema>,
  ) {
    const user = requireUser(c);
    const row = await this.deps.create.execute({
      excerptId,
      userId: user.user_id,
      start: body.start,
      end: body.end,
      wordId: body.word_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaLemmaLinkWire(row) }, 201);
  }

  async proposeCorrection(
    c: Context<{ Variables: AppVariables }>,
    excerptId: string,
    linkId: string,
    body: z.infer<typeof proposeKaryaLemmaCorrectionBodySchema>,
  ) {
    const user = requireUser(c);
    const row = await this.deps.proposeCorrection.execute({
      excerptId,
      linkId,
      userId: user.user_id,
      wordId: body.word_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaLemmaLinkWire(row) });
  }

  async resolveCorrection(
    c: Context<{ Variables: AppVariables }>,
    excerptId: string,
    linkId: string,
    body: z.infer<typeof resolveKaryaLemmaCorrectionBodySchema>,
  ) {
    const user = requireUser(c);
    const row = await this.deps.resolveCorrection.execute({
      excerptId,
      linkId,
      reviewerId: user.user_id,
      action: body.action,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: toKaryaLemmaLinkWire(row) });
  }

  async deleteLink(c: Context<{ Variables: AppVariables }>, linkId: string) {
    const user = requireUser(c);
    const roles = user.roles ?? [];
    const isStaff = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor', 'verifier'].includes(r),
    );
    await this.deps.deleteLink.execute({
      linkId,
      userId: user.user_id,
      isStaff,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: { ok: true as const } });
  }
}