import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import {
  actionForStatusChange,
  diffSnapshots,
  type EntityChangeAction,
  type ExploreEntityType,
  type Snapshot,
} from '../domain/entity-change';

export interface EntityChangeContext {
  /** Pelaku perubahan (admin / pengusul yang usulannya diterima). */
  actorId: string | null;
  /** Usulan asal perubahan, bila ada. */
  sourceContributionId?: string | null;
  requestId?: string | null;
}

/**
 * Catat riwayat perubahan entitas eksplorasi ke `audit_logs` (best-effort,
 * kegagalan tidak boleh menggagalkan request). Snapshot hanya berisi field
 * publik; lihat `entity-change.ts`.
 */
export class RecordEntityChange {
  constructor(private readonly audit: AuditLogRepository) {}

  async created(
    entityType: ExploreEntityType,
    entityId: string,
    after: Snapshot,
    ctx: EntityChangeContext,
  ): Promise<void> {
    await this.write(entityType, entityId, 'create', null, after, ctx);
  }

  /** Tanpa perbedaan snapshot = tidak ada baris riwayat. */
  async updated(
    entityType: ExploreEntityType,
    entityId: string,
    before: Snapshot,
    after: Snapshot,
    ctx: EntityChangeContext,
  ): Promise<void> {
    const diff = diffSnapshots(before, after);
    if (!diff) return;
    const action = actionForStatusChange(
      (before.status as string | null) ?? null,
      (after.status as string | null) ?? null,
    );
    await this.write(entityType, entityId, action, diff.old, diff.new, ctx);
  }

  async deleted(
    entityType: ExploreEntityType,
    entityId: string,
    before: Snapshot,
    ctx: EntityChangeContext,
  ): Promise<void> {
    await this.write(entityType, entityId, 'takedown', before, null, ctx);
  }

  async photosChanged(
    entityType: ExploreEntityType,
    entityId: string,
    kind: 'photo_add' | 'photo_remove',
    count: number,
    ctx: EntityChangeContext,
  ): Promise<void> {
    if (count <= 0) return;
    await this.write(
      entityType,
      entityId,
      kind,
      kind === 'photo_remove' ? { removed: count } : null,
      kind === 'photo_add' ? { added: count } : null,
      ctx,
    );
  }

  private async write(
    entityType: ExploreEntityType,
    entityId: string,
    action: EntityChangeAction,
    oldData: Record<string, unknown> | null,
    newData: Record<string, unknown> | null,
    ctx: EntityChangeContext,
  ): Promise<void> {
    await this.audit.record({
      userId: ctx.actorId,
      action,
      entityType,
      entityId,
      oldData,
      newData,
      requestId: ctx.requestId ?? null,
      sourceContributionId: ctx.sourceContributionId ?? null,
    });
  }
}

/** Normalisasi ctx opsional dari use-case jadi EntityChangeContext lengkap. */
export function toChangeCtx(ctx?: Partial<EntityChangeContext>): EntityChangeContext {
  return {
    actorId: ctx?.actorId ?? null,
    sourceContributionId: ctx?.sourceContributionId,
    requestId: ctx?.requestId,
  };
}
