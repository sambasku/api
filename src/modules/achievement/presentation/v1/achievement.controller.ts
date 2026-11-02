import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppVariables } from '@/shared/types';
import type {
  Achievement,
  AchievementWithOwnership,
} from '../../domain/entities/achievement.entity';
import type {
  CreateAchievementUseCase,
  DeleteAchievementUseCase,
  GrantAchievementUseCase,
  PreviewAchievementUseCase,
  RevokeUserAchievementUseCase,
  SetActiveBorderUseCase,
  UpdateAchievementUseCase,
} from '../../application/use-cases/achievement-admin.use-cases';
import type { ScanAchievementUseCase } from '../../application/use-cases/scan-achievement.use-case';
import type {
  ListActiveAchievementsUseCase,
  ListMyAchievementsUseCase,
  ListUserAchievementsUseCase,
} from '../../application/use-cases/list-achievements.use-case';
import type { AchievementRepository } from '../../domain/repositories/achievement.repository';
import type {
  createAchievementBodySchema,
  grantAchievementBodySchema,
  listAchievementsQuerySchema,
  scanAchievementBodySchema,
  setBorderBodySchema,
  updateAchievementBodySchema,
} from './validators/achievement.validator';

export function serializeAchievement(
  a: Achievement | AchievementWithOwnership,
): Record<string, unknown> {
  const owned = a as AchievementWithOwnership;
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    category: a.category,
    reward_type: a.rewardType,
    badge_url: a.badgeUrl,
    criteria: a.criteria,
    family: a.family,
    level: a.level,
    is_active: a.isActive,
    created_at: Math.floor(a.createdAt.getTime() / 1000),
    updated_at: a.updatedAt ? Math.floor(a.updatedAt.getTime() / 1000) : null,
    // Status kepemilikan (null = locked).
    user_achievement_id: owned.userAchievementId ?? null,
    awarded_at: owned.awardedAt ? Math.floor(owned.awardedAt.getTime() / 1000) : null,
    ...(owned.isActiveBorder === undefined ? {} : { is_active_border: owned.isActiveBorder }),
    // Progress locked agregat (hanya /me; null = tidak relevan).
    ...(owned.progress === undefined
      ? {}
      : {
          progress: owned.progress
            ? { current: owned.progress.current, target: owned.progress.target }
            : null,
        }),
  };
}

export class AchievementController {
  constructor(
    private readonly deps: {
      create: CreateAchievementUseCase;
      update: UpdateAchievementUseCase;
      remove: DeleteAchievementUseCase;
      grant: GrantAchievementUseCase;
      revoke: RevokeUserAchievementUseCase;
      preview: PreviewAchievementUseCase;
      scan: ScanAchievementUseCase;
      setBorder: SetActiveBorderUseCase;
      listActive: ListActiveAchievementsUseCase;
      listMine: ListMyAchievementsUseCase;
      listByUsername: ListUserAchievementsUseCase;
      repo: AchievementRepository;
    },
  ) {}

  // ------------------------------------------------------------- admin --

  listAdmin(c: Context<{ Variables: AppVariables }>, query: z.infer<typeof listAchievementsQuerySchema>) {
    return this.deps.repo
      .listAdmin({
        rewardType: query.reward_type as never,
        category: query.category as never,
        limit: query.limit,
        before: query.before,
        onlyActive: false,
      })
      .then((result) =>
        c.json({
          success: true as const,
          data: {
            items: result.items.map((a) => ({
              ...serializeAchievement(a),
              recipient_count: a.recipientCount,
            })),
            next_cursor: result.nextCursor,
          },
        }),
      );
  }

  create(c: Context<{ Variables: AppVariables }>, body: z.infer<typeof createAchievementBodySchema>) {
    const user = c.get('user')!;
    return this.deps.create
      .execute({
        code: body.code,
        title: body.title,
        description: body.description,
        category: body.category,
        rewardType: body.reward_type,
        badgeUrl: body.badge_url ?? null,
        criteria: body.criteria,
        family: body.family ?? null,
        level: body.level ?? null,
        isActive: body.is_active ?? true,
        actorId: user.user_id,
      })
      .then((created) =>
        c.json({ success: true as const, data: serializeAchievement(created) }, 200),
      );
  }

  update(c: Context<{ Variables: AppVariables }>, id: string, body: z.infer<typeof updateAchievementBodySchema>) {
    const user = c.get('user')!;
    return this.deps.update
      .execute({
        id,
        title: body.title,
        description: body.description,
        category: body.category,
        rewardType: body.reward_type,
        badgeUrl: body.badge_url,
        criteria: body.criteria,
        family: body.family,
        level: body.level,
        isActive: body.is_active,
        actorId: user.user_id,
      })
      .then((updated) =>
        c.json({ success: true as const, data: serializeAchievement(updated) }, 200),
      );
  }

  async remove(c: Context<{ Variables: AppVariables }>, id: string) {
    const user = c.get('user')!;
    await this.deps.remove.execute({ id, actorId: user.user_id, requestId: c.get('requestId') });
    return c.json({ success: true as const, data: null }, 200);
  }

  async scan(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof scanAchievementBodySchema>,
  ) {
    const user = c.get('user')!;
    const achievement = await this.deps.repo.findById(id);
    if (!achievement) {
      const { NotFoundError } = await import('@/shared/errors/app-error');
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Achievement tidak ditemukan');
    }
    const result = await this.deps.scan.execute({
      achievement,
      limit: body.limit,
      actorId: user.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: result }, 200);
  }

  grant(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: z.infer<typeof grantAchievementBodySchema>,
  ) {
    const user = c.get('user')!;
    return this.deps.grant
      .execute({
        achievementId: id,
        usernames: body.usernames,
        actorId: user.user_id,
        requestId: c.get('requestId'),
      })
      .then((result) => c.json({ success: true as const, data: result }, 200));
  }

  async preview(c: Context<{ Variables: AppVariables }>, id: string) {
    const result = await this.deps.preview.execute(id);
    return c.json(
      {
        success: true as const,
        data: {
          total: result.total,
          sample: result.sample.map((s) => ({
            username: s.username,
            display_name: s.displayName,
            matched_at: s.matchedAt,
          })),
        },
      },
      200,
    );
  }

  async revoke(c: Context<{ Variables: AppVariables }>, awardId: string) {
    const user = c.get('user')!;
    await this.deps.revoke.execute({
      awardId,
      actorId: user.user_id,
      requestId: c.get('requestId'),
    });
    return c.json({ success: true as const, data: null }, 200);
  }

  /** Daftar penerima (award id) untuk aksi revoke di console. */
  async listRecipients(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    query: { limit: number; before?: string },
  ) {
    const result = await this.deps.repo.listRecipients(id, query.limit, query.before);
    return c.json({
      success: true as const,
      data: {
        items: result.items.map((r) => ({
          award_id: r.awardId,
          username: r.username,
          display_name: r.displayName,
          awarded_at: Math.floor(r.awardedAt.getTime() / 1000),
          granted_via: r.grantedVia,
        })),
        next_cursor: result.nextCursor,
      },
    });
  }

  // ------------------------------------------------------------ publik --

  listPublic(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listAchievementsQuerySchema>,
  ) {
    return this.deps.listActive
      .execute({
        rewardType: query.reward_type as never,
        category: query.category as never,
        limit: query.limit,
        before: query.before,
      })
      .then((result) =>
        c.json({
          success: true as const,
          data: {
            items: result.items.map(serializeAchievement),
            next_cursor: result.nextCursor,
          },
        }),
      );
  }

  listMine(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listAchievementsQuerySchema>,
  ) {
    const user = c.get('user')!;
    return this.deps.listMine
      .execute(user.user_id, {
        rewardType: query.reward_type as never,
        category: query.category as never,
        limit: query.limit,
        before: query.before,
      })
      .then((result) =>
        c.json({
          success: true as const,
          data: {
            items: result.items.map(serializeAchievement),
            next_cursor: result.nextCursor,
          },
        }),
      );
  }

  async listByUsername(c: Context<{ Variables: AppVariables }>, username: string) {
    const items = await this.deps.listByUsername.execute(username);
    return c.json({
      success: true as const,
      data: { items: items.map(serializeAchievement) },
    });
  }

  setBorder(c: Context<{ Variables: AppVariables }>, body: z.infer<typeof setBorderBodySchema>) {
    const user = c.get('user')!;
    return this.deps.setBorder
      .execute({
        userId: user.user_id,
        borderId: body.border_id,
        requestId: c.get('requestId'),
      })
      .then((result) =>
        c.json(
          { success: true as const, data: { active_border_id: result.activeBorderId } },
          200,
        ),
      );
  }
}
