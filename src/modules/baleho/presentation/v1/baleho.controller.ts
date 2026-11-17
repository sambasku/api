import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { BalehoUseCases } from '../../application/baleho.use-cases';
import type {
  balehoEventBodySchema,
  createBalehoPlacementBodySchema,
  rejectBalehoBodySchema,
} from './validators/baleho.validator';

type CreateBody = z.infer<typeof createBalehoPlacementBodySchema>;
type EventBody = z.infer<typeof balehoEventBodySchema>;
type RejectBody = z.infer<typeof rejectBalehoBodySchema>;

function serializeBoard(board: Awaited<ReturnType<BalehoUseCases['getBoard']>>) {
  return {
    slide: board.slide,
    cols: board.cols,
    rows: board.rows,
    placements: board.placements.map((p) => ({
      id: p.id,
      slide: p.slide,
      col: p.col,
      row: p.row,
      w: p.w,
      h: p.h,
      status: p.status,
      advertiser_user_id: p.advertiserUserId,
      is_owner_pending: p.isOwnerPending,
      entity_type: p.entityType,
      entity_id: p.entityId,
      frames: p.frames.map((f) => ({
        id: f.id,
        sort_order: f.sortOrder,
        media_type: f.mediaType,
        media_url: f.mediaUrl,
        title: f.title,
        cta_label: f.ctaLabel,
        action_type: f.actionType,
        action_payload: f.actionPayload,
      })),
    })),
  };
}

export class BalehoController {
  constructor(private readonly uc: BalehoUseCases) {}

  async getBoard(c: Context<{ Variables: AppVariables }>, slide: number) {
    const viewer = c.get('user')?.user_id ?? null;
    const board = await this.uc.getBoard(slide, viewer);
    return c.json({ success: true as const, data: serializeBoard(board) });
  }

  async createPlacement(
    c: Context<{ Variables: AppVariables }>,
    body: CreateBody,
  ) {
    const userId = c.get('user')!.user_id;
    const result = await this.uc.createPlacement(userId, {
      slide: body.slide,
      col: body.col,
      row: body.row,
      w: body.w,
      h: body.h,
      referralUsername: body.referral_username,
      entityType: body.entity_type,
      entityId: body.entity_id,
      days: body.days,
      creativeId: body.creative_id,
      frames: body.frames.map((f) => ({
        mediaType: f.media_type,
        mediaUrl: f.media_url,
        title: f.title,
        ctaLabel: f.cta_label,
        actionType: f.action_type,
        actionPayload: f.action_payload,
      })),
    });
    return c.json(
      {
        success: true as const,
        data: {
          placement_id: result.placementId,
          creative_id: result.creativeId,
        },
      },
      201,
    );
  }

  async recordEvent(
    c: Context<{ Variables: AppVariables }>,
    body: EventBody,
  ) {
    await this.uc.recordEvent(
      body.placement_id,
      body.frame_id ?? null,
      body.event_type,
    );
    return c.json({ success: true as const, data: { ok: true } });
  }

  async adminList(c: Context<{ Variables: AppVariables }>) {
    const rows = await this.uc.listAdmin(100);
    return c.json({
      success: true as const,
      data: rows.map((r) => ({
        id: r.id,
        slide: r.slide,
        col: r.col,
        row: r.row,
        w: r.w,
        h: r.h,
        status: r.status,
        advertiser_user_id: r.advertiserUserId,
        advertiser_username: r.advertiserUsername,
        referral_username: r.referralUsername,
        created_at: r.createdAt.toISOString(),
      })),
    });
  }

  async adminApprove(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
  ) {
    await this.uc.approve(placementId);
    return c.json({ success: true as const, data: { id: placementId } });
  }

  async adminReject(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
    body: RejectBody,
  ) {
    await this.uc.reject(placementId, body.reason);
    return c.json({ success: true as const, data: { id: placementId } });
  }

  async adminMarkPaid(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
  ) {
    await this.uc.markPaid(placementId);
    return c.json({ success: true as const, data: { id: placementId } });
  }

  async adminPause(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
    body: RejectBody,
  ) {
    await this.uc.pause(placementId, body.reason);
    return c.json({ success: true as const, data: { id: placementId } });
  }
}
