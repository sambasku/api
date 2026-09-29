import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { UgcAbuseEventRepository } from '@/shared/moderation/ugc-abuse-event.repository';
import type { UgcAnonAbuseRepository } from '@/shared/moderation/ugc-anon-abuse.repository';
import type { LiftAbuseMuteUseCase } from '../../application/use-cases/lift-abuse-mute.use-case';
import type {
  LiftAnonMuteBody,
  ListAnonAbuseEventsQuery,
  ListUserAbuseEventsQuery,
} from './validators/abuse.validator';

type AdminCtx = Context<{ Variables: AppVariables }>;

// ponytail: mute aktif anon tanpa paging, dibatasi 100 baris terbaru.
// Upgrade ke cursor bila daftar mute rutin melebihi batas ini.
const ANON_MUTE_LIMIT = 100;

export class AbuseController {
  constructor(
    private readonly deps: {
      abuseRepo: UgcAbuseEventRepository;
      anonRepo: UgcAnonAbuseRepository;
      lift: LiftAbuseMuteUseCase;
    },
  ) {}

  async listUserEvents(c: AdminCtx, query: ListUserAbuseEventsQuery) {
    const { items, nextCursor, hasMore } = await this.deps.abuseRepo.listAll({
      signal: query.signal,
      userName: query.user_name,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: items.map((e) => ({
        id: e.id,
        user_id: e.userId,
        username: e.username,
        user_can_contribute: e.userCanContribute,
        user_muted_until: e.userMutedUntil ? e.userMutedUntil.toISOString() : null,
        signal: e.signal,
        weight: e.weight,
        entity_type: e.entityType,
        entity_id: e.entityId,
        meta: e.meta,
        created_at: e.createdAt.toISOString(),
      })),
      meta: { limit: query.limit, next_cursor: nextCursor, has_more: hasMore },
    });
  }

  async listAnonEvents(c: AdminCtx, query: ListAnonAbuseEventsQuery) {
    const { items, nextCursor, hasMore } = await this.deps.anonRepo.listEvents({
      subjectKind: query.subject_kind,
      subjectKey: query.subject_key || undefined,
      signal: query.signal,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: items.map((e) => ({
        id: e.id,
        subject_kind: e.subjectKind,
        subject_key: e.subjectKey,
        signal: e.signal,
        weight: e.weight,
        entity_type: e.entityType,
        entity_id: e.entityId,
        meta: e.meta,
        created_at: e.createdAt.toISOString(),
      })),
      meta: { limit: query.limit, next_cursor: nextCursor, has_more: hasMore },
    });
  }

  async listAnonMutes(c: AdminCtx) {
    const rows = await this.deps.anonRepo.listActiveMutes(ANON_MUTE_LIMIT);
    return c.json({
      success: true as const,
      data: rows.map((m) => ({
        subject_kind: m.subjectKind,
        subject_key: m.subjectKey,
        muted_until: m.mutedUntil.toISOString(),
        updated_at: m.updatedAt ? m.updatedAt.toISOString() : null,
      })),
    });
  }

  async liftAnonMute(c: AdminCtx, body: LiftAnonMuteBody) {
    const result = await this.deps.lift.liftAnon({
      subject: { kind: body.subject_kind, key: body.subject_key },
      actorId: c.get('user')!.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({
      success: true as const,
      data: {
        subject_kind: body.subject_kind,
        subject_key: body.subject_key,
        removed: result.removed,
        previous_score_30d: result.previousScore30d,
      },
    });
  }

  async liftUserMute(c: AdminCtx, userId: string) {
    const result = await this.deps.lift.liftUser({
      userId,
      actorId: c.get('user')!.user_id,
      requestId: c.get('requestId') ?? null,
    });
    return c.json({
      success: true as const,
      data: {
        id: result.id,
        contribute_muted_until: null,
        previous_score_30d: result.previousScore30d,
      },
    });
  }
}
