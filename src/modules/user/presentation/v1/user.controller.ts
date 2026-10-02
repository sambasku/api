import type { Context } from 'hono';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { GetPublicProfileUseCase } from '../../application/use-cases/get-public-profile.use-case';
import type { GetPublicActivityUseCase } from '../../application/use-cases/get-public-activity.use-case';
import type { SuggestMentionUsersUseCase } from '../../application/use-cases/suggest-mention-users.use-case';
import type { MentionUserRow } from '../../domain/entities/public-profile.entity';
import type { UploadAvatarUseCase } from '../../application/use-cases/upload-avatar.use-case';
import type { DeleteAvatarUseCase } from '../../application/use-cases/delete-avatar.use-case';
import type {
  GetMyProfileUseCase,
  UpdateMyProfileUseCase,
} from '../../application/use-cases/update-my-profile.use-case';
import { MAX_IMAGE_BYTES } from '@/modules/public-image/application/utils/validate-image-file';
import type { UpdateMyProfileBody } from './validators/update-my-profile.validator';
import type { PublicActivityQuery } from './validators/public-profile.validator';

export class UserController {
  constructor(
    private readonly deps: {
      getPublicProfile: GetPublicProfileUseCase;
      getPublicActivity: GetPublicActivityUseCase;
      suggestMention: SuggestMentionUsersUseCase;
      uploadAvatar: UploadAvatarUseCase;
      deleteAvatar: DeleteAvatarUseCase;
      getMyProfile: GetMyProfileUseCase;
      updateMyProfile: UpdateMyProfileUseCase;
    },
  ) {}

  async publicProfile(c: Context, username: string) {
    const profile = await this.deps.getPublicProfile.execute(username);

    return c.json({
      success: true as const,
      data: {
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
        role: profile.role,
        is_verifier: profile.isVerifier,
        joined_at: profile.joinedAt.toISOString(),
        avatar_url: profile.avatarUrl,
        stats: {
          contributions_approved: profile.stats.contributionsApproved,
          verifications_done: profile.stats.verificationsDone,
          comments_published: profile.stats.commentsPublished,
        },
      },
    });
  }

  async publicActivity(c: Context, username: string, query: PublicActivityQuery) {
    const result = await this.deps.getPublicActivity.execute(username, query);
    return c.json({
      success: true as const,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          occurred_at: item.occurredAt.toISOString(),
          word_id: item.wordId,
          lemma: item.lemma,
          summary: item.summary,
        })),
      },
      // Mode merge (tanpa filter kind) tidak punya cursor - meta diabaikan.
      ...(result.nextCursor === undefined
        ? {}
        : {
            meta: {
              limit: query.limit,
              next_cursor: result.nextCursor,
              has_more: result.nextCursor !== null,
            },
          }),
    });
  }
  async getMyProfile(c: Context) {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    const profile = await this.deps.getMyProfile.execute(user.user_id);
    return c.json({
      success: true as const,
      data: {
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
        avatar_url: profile.avatarUrl,
      },
    });
  }

  async suggestMention(c: Context, q: string) {
    if (q.length < 2) {
      throw new BadRequestError('VALIDATION_ERROR', 'Query pencarian wajib minimal 2 karakter');
    }
    const items = await this.deps.suggestMention.execute(q);
    return c.json({
      success: true as const,
      data: {
        items: items.map((item) => ({
          id: item.id,
          username: item.username,
          display_name: item.displayName,
          avatar_url: item.avatarUrl ?? null,
        })),
      },
    });
  }

  /** Internal method untuk routes cache - return raw items. */
  async suggestMentionInternal(q: string): Promise<MentionUserRow[]> {
    return this.deps.suggestMention.execute(q);
  }

  async updateMyProfile(c: Context, body: UpdateMyProfileBody) {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    const profile = await this.deps.updateMyProfile.execute(user.user_id, {
      displayName: body.display_name,
      bio: body.bio,
    });
    return c.json({
      success: true as const,
      data: {
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
        avatar_url: profile.avatarUrl,
      },
    });
  }

  async uploadAvatar(c: Context) {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');

    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_IMAGE_BYTES + 1024 * 1024) {
      throw new BadRequestError('IMAGE_TOO_LARGE', 'File gambar terlalu besar (maks 5 MB)', [
        { field: 'file', message: 'Ukuran maksimal 5 MB' },
      ]);
    }

    const body = await c.req.parseBody({ all: true });
    const filePart = body['file'];
    if (!filePart || typeof filePart === 'string') {
      throw new BadRequestError('VALIDATION_ERROR', 'File gambar wajib diunggah', [
        { field: 'file', message: 'Field multipart `file` wajib berisi file' },
      ]);
    }

    const file = filePart as File;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await this.deps.uploadAvatar.execute(user.user_id, {
      bytes,
      mimeType: file.type || null,
      filename: file.name || null,
    });

    return c.json(
      {
        success: true as const,
        data: { avatar_url: result.avatarUrl },
      },
      200,
    );
  }

  async deleteAvatar(c: Context) {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    await this.deps.deleteAvatar.execute(user.user_id);
    return c.body(null, 204);
  }
}
