import type { Context } from 'hono';
import type { z } from 'zod';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { WordGroupRecord } from '../../domain/entities/word-group.entity';
import type {
  AddWordGroupMemberUseCase,
  CreateWordGroupUseCase,
  DeleteWordGroupUseCase,
  GetWordGroupUseCase,
  ListWordGroupsUseCase,
  RemoveWordGroupMemberUseCase,
  UpdateWordGroupUseCase,
} from '../../application/use-cases/word-group.use-cases';
import type {
  addWordGroupMemberBodySchema,
  createWordGroupBodySchema,
  listWordGroupsQuerySchema,
  removeWordGroupMemberQuerySchema,
  updateWordGroupBodySchema,
} from './validators/word-group.validator';

function serialize(g: WordGroupRecord) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    status: g.status,
    is_verified: g.isVerified,
    members: g.members.map((m) => ({
      id: m.id,
      word_id: m.wordId,
      lemma: m.lemma,
      notes: m.notes,
      status: m.status,
    })),
  };
}

function actorOf(c: Context<{ Variables: AppVariables }>) {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
  return user;
}

export class WordGroupController {
  constructor(
    private readonly deps: {
      create: CreateWordGroupUseCase;
      update: UpdateWordGroupUseCase;
      remove: DeleteWordGroupUseCase;
      list: ListWordGroupsUseCase;
      getById: GetWordGroupUseCase;
      addMember: AddWordGroupMemberUseCase;
      removeMember: RemoveWordGroupMemberUseCase;
    },
  ) {}

  /** Publik: hanya kelompok published (anggota published menyesuaikan di repo). */
  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listWordGroupsQuerySchema>,
  ) {
    return this.deps.list
      .execute({
        limit: query.limit,
        before: query.before,
        q: query.q,
        wordId: query.word_id,
        publicOnly: true,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  getByIdPublic(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deps.getById
      .execute(id, true)
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listWordGroupsQuerySchema>,
  ) {
    return this.deps.list
      .execute({
        limit: query.limit,
        before: query.before,
        q: query.q,
        status: query.status,
        wordId: query.word_id,
        publicOnly: false,
      })
      .then((r) =>
        c.json({
          success: true as const,
          data: { items: r.items.map(serialize), next_cursor: r.nextCursor },
        }),
      );
  }

  getByIdAdmin(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.deps.getById
      .execute(id, false)
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  create(
    c: Context<{ Variables: AppVariables }>,
    body: z.infer<typeof createWordGroupBodySchema>,
  ) {
    const actor = actorOf(c);
    // PRD relasi-lemma: verifikator boleh tayang langsung; contributor
    // masuk antrean (pending_review) - pola resolvePublication Section 22.
    const canPublish = isVerifierRole(actor.role);
    const status = body.status ?? (canPublish ? 'published' : 'pending_review');
    return this.deps.create
      .execute({
        name: body.name,
        description: body.description ?? null,
        status,
        isVerified: status === 'published' && canPublish,
        createdBy: actor.user_id,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof updateWordGroupBodySchema>,
  ) {
    const actor = actorOf(c);
    return this.deps.update
      .execute({
        id,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedBy: actor.user_id,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const actor = actorOf(c);
    return this.deps.remove
      .execute(id, actor.user_id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  addMember(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof addWordGroupMemberBodySchema>,
  ) {
    const actor = actorOf(c);
    const canPublish = isVerifierRole(actor.role);
    const status = body.status ?? (canPublish ? 'published' : 'pending_review');
    return this.deps.addMember
      .execute({
        groupId: id,
        wordId: body.word_id,
        notes: body.notes ?? null,
        status,
        createdBy: actor.user_id,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  removeMember(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof removeWordGroupMemberQuerySchema>,
  ) {
    const actor = actorOf(c);
    return this.deps.removeMember
      .execute(query.id, query.word_id, actor.user_id)
      .then(() => c.json({ success: true as const, data: null }));
  }
}
