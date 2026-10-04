import type { Context } from 'hono';
import type { ListAdminUsersUseCase } from '../../application/use-cases/list-admin-users.use-case';
import type { UpdateUserRoleUseCase } from '../../application/use-cases/update-user-role.use-case';
import type { SetCanContributeUseCase } from '../../application/use-cases/set-can-contribute.use-case';
import type { CreateAdminUserUseCase } from '../../application/use-cases/create-admin-user.use-case';
import type { SetUserActiveUseCase } from '../../application/use-cases/set-user-active.use-case';
import type { ListUserAbuseEventsUseCase } from '../../application/use-cases/list-user-abuse-events.use-case';
import type { User, UserRole } from '../../domain/entities/user.entity';
import type { AppVariables } from '@/shared/types';
import type {
  CreateAdminUserBody,
  ListAdminUsersQuery,
  UpdateUserRoleBody,
} from './validators/admin-users.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

export class AdminUsersController {
  constructor(
    private readonly deps: {
      list: ListAdminUsersUseCase;
      updateRole: UpdateUserRoleUseCase;
      setCanContribute: SetCanContributeUseCase;
      createUser: CreateAdminUserUseCase;
      setActive: SetUserActiveUseCase;
      listAbuseEvents: ListUserAbuseEventsUseCase;
    },
  ) {}

  private toWire(u: User) {
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      roles: u.roles,
      role: u.role,
      is_active: u.isActive,
      can_contribute: u.canContribute,
      contribute_muted_until: u.contributeMutedUntil
        ? u.contributeMutedUntil.toISOString()
        : null,
      created_at: u.createdAt.toISOString(),
      updated_at: u.updatedAt ? u.updatedAt.toISOString() : null,
    };
  }

  async list(c: AdminCtx, query: ListAdminUsersQuery) {
    const { items, meta } = await this.deps.list.execute({
      q: query.q,
      role: query.role as UserRole | undefined,
      canContribute: query.can_contribute,
      limit: query.limit,
      cursor: query.cursor,
    });

    return c.json({
      success: true as const,
      data: items.map((u) => this.toWire(u)),
      meta,
    });
  }

  async listAbuseEvents(
    c: AdminCtx,
    targetId: string,
    query: { limit: number; cursor?: string },
  ) {
    const { items, nextCursor, hasMore } = await this.deps.listAbuseEvents.execute({
      userId: targetId,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: items.map((e) => ({
        id: e.id,
        signal: e.signal,
        weight: e.weight,
        entity_type: e.entityType,
        entity_id: e.entityId,
        meta: e.meta,
        created_at: e.createdAt.toISOString(),
      })),
      meta: {
        limit: query.limit,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  }

  async updateRole(
    c: AdminCtx,
    targetId: string,
    body: UpdateUserRoleBody,
  ) {
    const user = c.get('user')!;
    const requestId = c.get('requestId') ?? null;

    const result = await this.deps.updateRole.execute({
      targetUserId: targetId,
      newRoles: body.roles as UserRole[],
      actorId: user.user_id,
      actorRoles: user.roles,
      requestId,
    });

    return c.json({ success: true as const, data: result });
  }

  async setCanContribute(c: AdminCtx, targetId: string, canContribute: boolean) {
    const user = c.get('user')!;
    const result = await this.deps.setCanContribute.execute({
      targetUserId: targetId,
      canContribute,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({
      success: true as const,
      data: {
        id: result.id,
        can_contribute: result.canContribute,
        contribute_muted_until: null,
      },
    });
  }

  async create(c: AdminCtx, body: CreateAdminUserBody) {
    const user = c.get('user')!;
    const created = await this.deps.createUser.execute({
      username: body.username,
      email: body.email,
      phone: body.phone,
      password: body.password,
      roles: body.roles,
      isActive: body.is_active,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: this.toWire(created) }, 201);
  }

  async setActive(c: AdminCtx, targetId: string, isActive: boolean) {
    const user = c.get('user')!;
    const result = await this.deps.setActive.execute({
      targetUserId: targetId,
      isActive,
      actorId: user.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({ success: true as const, data: { id: result.id, is_active: result.isActive } });
  }
}
