import type { Context } from 'hono';
import type { CreateLemmaMergeBody } from './lemma-merge.validator';
import type { CreateLemmaMergeUseCase } from '../../application/create-lemma-merge.use-case';
import type { ApproveLemmaMergeUseCase } from '../../application/approve-lemma-merge.use-case';
import type { RejectLemmaMergeUseCase } from '../../application/reject-lemma-merge.use-case';
import type { LemmaMergeAdminReadUseCase } from '../../application/lemma-merge-admin-read.use-case';
import {
  lemmaMergeDetailResponseSchema,
  lemmaMergeListResponseSchema,
  lemmaMergeResponseSchema,
} from './lemma-merge.validator';
import type { AppVariables } from '@/shared/types';

export class LemmaMergeController {
  constructor(
    private readonly create: CreateLemmaMergeUseCase,
    private readonly approveUseCase: ApproveLemmaMergeUseCase,
    private readonly rejectUseCase: RejectLemmaMergeUseCase,
    private readonly adminRead: LemmaMergeAdminReadUseCase,
  ) {}

  async createMerge(c: Context<{ Variables: AppVariables }>, body: CreateLemmaMergeBody) {
    const user = c.get('user')!;
    const result = await this.create.execute({
      proposerId: user.user_id,
      actorRole: user.role,
      keepWordId: body.keep_word_id,
      mergeWordIds: body.merge_word_ids,
      reasonText: body.reason_text,
    });
    const message = result.applied
      ? 'Kata berhasil digabung.'
      : 'Usulan gabung dikirim. Tim akan tinjau.';
    return c.json(
      lemmaMergeResponseSchema.parse({
        success: true,
        data: {
          id: result.id,
          status: result.status,
          keep_word_id: result.keepWordId,
          merge_word_ids: result.mergeWordIds,
          keep_lemma: result.keepLemma,
          message,
        },
      }),
      result.applied ? 200 : 201,
    );
  }

  async approveMerge(c: Context<{ Variables: AppVariables }>, id: string, reviewNote?: string) {
    const user = c.get('user')!;
    const result = await this.approveUseCase.execute({
      requestId: id,
      reviewerId: user.user_id,
      reviewNote,
    });
    return c.json({
      success: true,
      data: {
        id: result.requestId,
        status: 'approved' as const,
        keep_word_id: result.keepWordId,
        merge_word_ids: result.mergedWordIds,
        keep_lemma: result.keepLemma,
        message: 'Usulan gabung disetujui.',
      },
    });
  }

  async listMergesAdmin(
    c: Context<{ Variables: AppVariables }>,
    opts: { limit: number; cursor?: string; status?: 'pending' | 'approved' | 'rejected' },
  ) {
    const result = await this.adminRead.list({
      status: opts.status,
      limit: opts.limit,
      cursor: opts.cursor,
    });
    return c.json(
      lemmaMergeListResponseSchema.parse({
        success: true,
        data: result.items,
        meta: {
          limit: opts.limit,
          next_cursor: result.nextCursor,
          has_more: result.hasMore,
        },
      }),
    );
  }

  async getMergeDetailAdmin(c: Context<{ Variables: AppVariables }>, id: string) {
    const detail = await this.adminRead.getDetail(id);
    return c.json(lemmaMergeDetailResponseSchema.parse({ success: true, data: detail }));
  }

  async rejectMerge(c: Context<{ Variables: AppVariables }>, id: string, reviewNote?: string) {
    const user = c.get('user')!;
    const result = await this.rejectUseCase.execute({
      requestId: id,
      reviewerId: user.user_id,
      reviewNote,
    });
    return c.json({
      success: true,
      data: {
        id: result.requestId,
        status: result.status,
        message: 'Usulan gabung ditolak.',
      },
    });
  }
}