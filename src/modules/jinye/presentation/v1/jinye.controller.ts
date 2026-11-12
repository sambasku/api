import type { Context } from 'hono';
import {
  BadRequestError,
  UnauthorizedError,
} from '@/shared/errors/app-error';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { ImageController } from '@/modules/image/presentation/v1/image.controller';
import { MAX_AUDIO_BYTES } from '@/modules/word/application/utils/validate-audio-file';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { Jinye, JinyeComment } from '../../domain/entities/jinye.entity';
import type { CreateJinyeUseCase } from '../../application/use-cases/create-jinye.use-case';
import type { ListPublishedJinyeUseCase } from '../../application/use-cases/list-published-jinye.use-case';
import type { GetJinyeDetailUseCase } from '../../application/use-cases/get-jinye-detail.use-case';
import type { DeleteJinyeUseCase } from '../../application/use-cases/delete-jinye.use-case';
import type { AttachJinyeAudioUseCase } from '../../application/use-cases/attach-jinye-audio.use-case';
import type { CreateJinyeCommentUseCase } from '../../application/use-cases/create-jinye-comment.use-case';
import type { ListJinyeCommentsUseCase } from '../../application/use-cases/list-jinye-comments.use-case';
import type { DeleteJinyeCommentUseCase } from '../../application/use-cases/delete-jinye-comment.use-case';
import type { ArchiveJinyeUseCase } from '../../application/use-cases/archive-jinye.use-case';
import type { UnarchiveJinyeUseCase } from '../../application/use-cases/unarchive-jinye.use-case';
import type { PinJinyeUseCase } from '../../application/use-cases/pin-jinye.use-case';
import type { UnpinJinyeUseCase } from '../../application/use-cases/unpin-jinye.use-case';
import type { ListArchivedJinyeUseCase } from '../../application/use-cases/list-archived-jinye.use-case';
import type { CreateJinyeLemmaLinkUseCase } from '../../application/use-cases/create-jinye-lemma-link.use-case';
import type { ProposeJinyeLemmaCorrectionUseCase } from '../../application/use-cases/propose-jinye-lemma-correction.use-case';
import type { ResolveJinyeLemmaCorrectionUseCase } from '../../application/use-cases/resolve-jinye-lemma-correction.use-case';
import type { DeleteJinyeLemmaLinkUseCase } from '../../application/use-cases/delete-jinye-lemma-link.use-case';
import type { ListJinyeLemmaLinksUseCase } from '../../application/use-cases/list-jinye-lemma-links.use-case';
import type { PromoteJinyeExampleUseCase } from '../../application/use-cases/promote-jinye-example.use-case';
import type { UpdateJinyeUseCase } from '../../application/use-cases/update-jinye.use-case';
import type { GetJinyeEditHistoryUseCase } from '../../application/use-cases/get-jinye-edit-history.use-case';
import type { RepostJinyeUseCase } from '../../application/use-cases/repost-jinye.use-case';
import type { UnrepostJinyeUseCase } from '../../application/use-cases/unrepost-jinye.use-case';
import type { QuoteJinyeUseCase } from '../../application/use-cases/quote-jinye.use-case';
import type { ListAdminJinyeUseCase } from '../../application/use-cases/list-admin-jinye.use-case';
import type { TakedownJinyeUseCase } from '../../application/use-cases/takedown-jinye.use-case';
import type { TakedownJinyeCommentUseCase } from '../../application/use-cases/takedown-jinye-comment.use-case';
import type { JinyeLemmaLink } from '../../domain/entities/jinye.entity';
import type {
  CreateJinyeBody,
  CreateJinyeCommentBody,
  CreateJinyeLemmaLinkBody,
  ListAdminJinyeQuery,
  ListJinyeQuery,
  PromoteJinyeExampleBody,
  ProposeJinyeLemmaCorrectionBody,
  QuoteJinyeBody,
  ResolveJinyeLemmaCorrectionBody,
  UpdateJinyeBody,
} from './validators/jinye.validator';

function requireUser(c: Context<{ Variables: AppVariables }>): AuthUser {
  const user = c.get('user');
  if (!user) throw new UnauthorizedError();
  return user;
}

function toWire(
  j: Jinye,
  opts?: { exposeStaging?: boolean; isPinned?: boolean },
) {
  const published = j.status === 'published';
  const images = j.images.map((img) => {
    const hasPublic = typeof img.publicUrl === 'string' && img.publicUrl.length > 0;
    return {
      status: (hasPublic ? 'published' : 'pending_review') as
        | 'published'
        | 'pending_review',
      public_url: hasPublic ? img.publicUrl : null,
      content_warnings: hasPublic ? img.contentWarnings : [],
      ...(opts?.exposeStaging && !hasPublic
        ? { url: img.url, provider_file_id: img.providerFileId }
        : {}),
    };
  });

  const visible = published || !!opts?.exposeStaging;
  const audio =
    visible && j.audio
      ? {
          audio_url: j.audio.url,
          audio_mime_type: j.audio.mimeType,
          audio_duration_ms: j.audio.durationMs,
        }
      : null;

  return {
    id: j.id,
    user_id: j.userId,
    username: j.username,
    display_name: j.displayName,
    avatar_url: j.avatarUrl,
    is_verifier: isVerifierRole(j.userRole ?? ''),
    body: visible ? j.body : null,
    images,
    audio,
    repost_of_id: j.repostOfId,
    quote_body: visible ? j.quoteBody : null,
    status: j.status,
    comment_count: j.publishedCommentCount,
    repost_count: j.repostCount,
    upvotes: 0,
    downvotes: 0,
    created_at: j.createdAt.toISOString(),
    updated_at: j.updatedAt?.toISOString() ?? null,
    is_edited: !!j.isEdited,
    is_pinned: opts?.isPinned === true,
  };
}

type JinyeCommentImageWire = {
  status: 'published' | 'pending_review';
  public_url: string | null;
  content_warnings: string[];
  url?: string | null;
  provider_file_id?: string | null;
};

type JinyeCommentWire = {
  id: string;
  jinye_id: string;
  parent_id: string | null;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verifier: boolean;
  body: string;
  images: JinyeCommentImageWire[];
  status: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  replies?: JinyeCommentWire[];
};

function toCommentWire(
  c: JinyeComment,
  opts?: { exposeStaging?: boolean; includeReplies?: boolean },
): JinyeCommentWire {
  const images: JinyeCommentImageWire[] = c.images.map((img) => {
    const hasPublic = typeof img.publicUrl === 'string' && img.publicUrl.length > 0;
    return {
      status: (hasPublic ? 'published' : 'pending_review') as
        | 'published'
        | 'pending_review',
      public_url: hasPublic ? img.publicUrl : null,
      content_warnings: hasPublic ? img.contentWarnings : [],
      ...(opts?.exposeStaging && !hasPublic
        ? { url: img.url, provider_file_id: img.providerFileId }
        : {}),
    };
  });

  const wire: JinyeCommentWire = {
    id: c.id,
    jinye_id: c.jinyeId,
    parent_id: c.parentId,
    user_id: c.userId,
    username: c.username,
    display_name: c.displayName,
    avatar_url: c.avatarUrl,
    is_verifier: isVerifierRole(c.userRole ?? ''),
    body: c.body,
    images,
    status: c.status,
    created_at: c.createdAt.toISOString(),
    upvotes: 0,
    downvotes: 0,
  };
  if (opts?.includeReplies) {
    wire.replies = (c.replies ?? []).map((r) =>
      toCommentWire(r, { exposeStaging: opts.exposeStaging }),
    );
  }
  return wire;
}

export class JinyeController {
  constructor(
    private readonly deps: {
      create: CreateJinyeUseCase;
      listPublished: ListPublishedJinyeUseCase;
      getDetail: GetJinyeDetailUseCase;
      deleteJinye: DeleteJinyeUseCase;
      attachAudio: AttachJinyeAudioUseCase;
      createComment: CreateJinyeCommentUseCase;
      listComments: ListJinyeCommentsUseCase;
      deleteComment: DeleteJinyeCommentUseCase;
      archive: ArchiveJinyeUseCase;
      unarchive: UnarchiveJinyeUseCase;
      pin: PinJinyeUseCase;
      unpin: UnpinJinyeUseCase;
      listArchived: ListArchivedJinyeUseCase;
      createLemmaLink: CreateJinyeLemmaLinkUseCase;
      listLemmaLinks: ListJinyeLemmaLinksUseCase;
      proposeLemmaCorrection: ProposeJinyeLemmaCorrectionUseCase;
      resolveLemmaCorrection: ResolveJinyeLemmaCorrectionUseCase;
      deleteLemmaLink: DeleteJinyeLemmaLinkUseCase;
      promoteExample: PromoteJinyeExampleUseCase;
      update: UpdateJinyeUseCase;
      editHistory: GetJinyeEditHistoryUseCase;
      repost: RepostJinyeUseCase;
      unrepost: UnrepostJinyeUseCase;
      quote: QuoteJinyeUseCase;
      listAdmin: ListAdminJinyeUseCase;
      takedown: TakedownJinyeUseCase;
      takedownComment: TakedownJinyeCommentUseCase;
      imageController: ImageController;
    },
  ) {}

  async listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: ListAdminJinyeQuery,
  ) {
    const page = await this.deps.listAdmin.execute({
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
      username: query.username,
    });
    return c.json({
      success: true as const,
      data: page.items.map((j) => toWire(j, { exposeStaging: true })),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async takedown(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.takedown.execute({
      id,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({
      success: true as const,
      data: toWire(row, { exposeStaging: true }),
    });
  }

  async takedownComment(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.takedownComment.execute({
      commentId: id,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: null });
  }

  uploadCredentials(c: Context<{ Variables: AppVariables }>, folder: string) {
    return this.deps.imageController.uploadCredentials(c, folder);
  }

  async create(c: Context<{ Variables: AppVariables }>, body: CreateJinyeBody) {
    const user = requireUser(c);
    const row = await this.deps.create.execute({
      userId: user.user_id,
      body: body.body,
      images: (body.images ?? []).map((i) => ({
        url: i.url,
        providerFileId: i.provider_file_id,
        publicUrl: null,
        contentWarnings: [],
      })),
      hasPendingAudio: body.has_pending_audio === true,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) }, 201);
  }

  async list(c: Context<{ Variables: AppVariables }>, q: ListJinyeQuery) {
    const page = await this.deps.listPublished.execute({
      limit: q.limit,
      cursor: q.cursor,
      userId: q.user_id,
      username: q.username,
      wordId: q.word_id,
    });
    return c.json({
      data: page.items.map((j) =>
        toWire(j, { isPinned: page.pinnedId === j.id }),
      ),
      meta: { next_cursor: page.nextCursor },
    });
  }

  async listArchived(c: Context<{ Variables: AppVariables }>, q: ListJinyeQuery) {
    const user = requireUser(c);
    const page = await this.deps.listArchived.execute({
      userId: user.user_id,
      limit: q.limit,
      cursor: q.cursor,
    });
    return c.json({
      data: page.items.map((j) => toWire(j, { exposeStaging: true })),
      meta: { next_cursor: page.nextCursor },
    });
  }

  async archive(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.archive.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) });
  }

  async unarchive(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.unarchive.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) });
  }

  async pin(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.pin.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true, isPinned: true }) });
  }

  async unpin(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.unpin.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async detail(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user');
    const roles = user?.roles ?? [];
    const viewerIsAdmin = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor'].includes(r),
    );
    const row = await this.deps.getDetail.execute({
      id,
      viewerId: user?.user_id ?? null,
      viewerIsAdmin,
    });
    const exposeStaging =
      !!user && (user.user_id === row.userId || viewerIsAdmin);
    const links = await this.deps.listLemmaLinks.execute(row.id);
    return c.json({
      data: {
        ...toWire(row, {
          exposeStaging,
          isPinned: row.isPinned,
        }),
        lemma_links: links.map(toLemmaLinkWire),
      },
    });
  }

  async remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.deleteJinye.execute({
      id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async attachAudio(c: Context<{ Variables: AppVariables }>, jinyeId: string) {
    const user = requireUser(c);
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
      throw new BadRequestError('AUDIO_TOO_LARGE', 'File audio terlalu besar (maks 5 MB)', [
        { field: 'audio', message: 'Ukuran maksimal 5 MB' },
      ]);
    }

    const body = await c.req.parseBody({ all: true });
    const audioPart = body['audio'];
    if (!audioPart || typeof audioPart === 'string') {
      throw new BadRequestError('VALIDATION_ERROR', 'File audio wajib diunggah', [
        { field: 'audio', message: 'Field multipart `audio` wajib berisi file' },
      ]);
    }

    const file = audioPart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const row = await this.deps.attachAudio.execute({
      jinyeId,
      userId: user.user_id,
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
      durationMs: body['duration_ms'],
      requestId: c.get('requestId') ?? null,
    });

    return c.json({ data: toWire(row, { exposeStaging: true }) }, 200);
  }

  async createComment(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    body: CreateJinyeCommentBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.createComment.execute({
      jinyeId,
      userId: user.user_id,
      body: body.body,
      parentId: body.parent_id,
      images: (body.images ?? []).map((i) => ({
        url: i.url,
        providerFileId: i.provider_file_id,
        publicUrl: null,
        contentWarnings: [],
      })),
      requestId: c.get('requestId') ?? null,
    });
    return c.json(
      { data: toCommentWire(row, { exposeStaging: true }) },
      201,
    );
  }

  async listComments(c: Context<{ Variables: AppVariables }>, jinyeId: string) {
    const user = c.get('user');
    const roles = user?.roles ?? [];
    const viewerIsAdmin = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor'].includes(r),
    );
    const items = await this.deps.listComments.execute(jinyeId);
    // Staging URL hanya untuk author komen / admin (sama detail Jinye).
    const wireOne = (item: JinyeComment): ReturnType<typeof toCommentWire> =>
      toCommentWire(item, {
        exposeStaging:
          !!user && (user.user_id === item.userId || viewerIsAdmin),
        includeReplies: false,
      });

    return c.json({
      data: items.map((item) => ({
        ...wireOne(item),
        replies: (item.replies ?? []).map(wireOne),
      })),
    });
  }

  async deleteComment(
    c: Context<{ Variables: AppVariables }>,
    _jinyeId: string,
    commentId: string,
  ) {
    const user = requireUser(c);
    await this.deps.deleteComment.execute({
      id: commentId,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async listLemmaLinks(c: Context<{ Variables: AppVariables }>, jinyeId: string) {
    const items = await this.deps.listLemmaLinks.execute(jinyeId);
    return c.json({ data: items.map(toLemmaLinkWire) });
  }

  async createLemmaLink(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    body: CreateJinyeLemmaLinkBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.createLemmaLink.execute({
      jinyeId,
      userId: user.user_id,
      start: body.start,
      end: body.end,
      wordId: body.word_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toLemmaLinkWire(row) }, 201);
  }

  async proposeLemmaCorrection(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    linkId: string,
    body: ProposeJinyeLemmaCorrectionBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.proposeLemmaCorrection.execute({
      jinyeId,
      linkId,
      userId: user.user_id,
      wordId: body.word_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toLemmaLinkWire(row) });
  }

  async resolveLemmaCorrection(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    linkId: string,
    body: ResolveJinyeLemmaCorrectionBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.resolveLemmaCorrection.execute({
      jinyeId,
      linkId,
      reviewerId: user.user_id,
      action: body.action,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toLemmaLinkWire(row) });
  }

  async deleteLemmaLink(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    linkId: string,
  ) {
    const user = requireUser(c);
    const roles = user.roles ?? [];
    const isStaff = roles.some((r) =>
      ['admin', 'root', 'reviewer', 'editor', 'verifier'].includes(r),
    );
    await this.deps.deleteLemmaLink.execute({
      jinyeId,
      linkId,
      userId: user.user_id,
      isStaff,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async promoteExample(
    c: Context<{ Variables: AppVariables }>,
    jinyeId: string,
    body: PromoteJinyeExampleBody,
  ) {
    const user = requireUser(c);
    const out = await this.deps.promoteExample.execute({
      jinyeId,
      userId: user.user_id,
      role: user.roles?.[0] ?? 'contributor',
      wordId: body.word_id,
      meaningId: body.meaning_id,
      includeAudio: body.include_audio === true,
      targetSentence: body.target_sentence,
      requestId: c.get('requestId') ?? null,
    });
    return c.json(
      {
        data: {
          example_id: out.exampleId,
          word_audio_id: out.wordAudioId,
          status: out.status,
          is_verified: out.isVerified,
        },
      },
      201,
    );
  }

  async update(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: UpdateJinyeBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.update.execute({
      id,
      userId: user.user_id,
      body: body.body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) });
  }

  async editHistory(c: Context<{ Variables: AppVariables }>, id: string) {
    const data = await this.deps.editHistory.execute(id);
    return c.json({ data });
  }

  async repost(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    const row = await this.deps.repost.execute({
      jinyeId: id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) }, 201);
  }

  async unrepost(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = requireUser(c);
    await this.deps.unrepost.execute({
      jinyeId: id,
      userId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: { ok: true as const } });
  }

  async quote(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: QuoteJinyeBody,
  ) {
    const user = requireUser(c);
    const row = await this.deps.quote.execute({
      jinyeId: id,
      userId: user.user_id,
      quoteBody: body.quote_body,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ data: toWire(row, { exposeStaging: true }) }, 201);
  }
}

function toLemmaLinkWire(link: JinyeLemmaLink) {
  return {
    id: link.id,
    jinye_id: link.jinyeId,
    comment_id: link.commentId,
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
