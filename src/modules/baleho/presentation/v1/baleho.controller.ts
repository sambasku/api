import type { Context } from 'hono';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import { ForbiddenError, ServiceUnavailableError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import { deriveBalehoPerfMetrics } from '../../application/baleho-metrics';
import {
  computeEndsAtFromWindow,
  formatBalehoStartsOn,
} from '../../domain/baleho-schedule';
import type { BalehoUseCases } from '../../application/baleho.use-cases';
import type {
  balehoEventBodySchema,
  createBalehoPlacementBodySchema,
  markPaidBalehoBodySchema,
  rejectBalehoBodySchema,
} from './validators/baleho.validator';

type CreateBody = z.infer<typeof createBalehoPlacementBodySchema>;
type EventBody = z.infer<typeof balehoEventBodySchema>;
type RejectBody = z.infer<typeof rejectBalehoBodySchema>;
type MarkPaidBody = z.infer<typeof markPaidBalehoBodySchema>;

const PAYMENT_PROOF_ROLES = new Set(['root', 'admin']);

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
        body: f.body,
        cta_label: f.ctaLabel,
        action_type: f.actionType,
        action_payload: f.actionPayload,
      })),
    })),
  };
}

export class BalehoController {
  constructor(
    private readonly uc: BalehoUseCases,
    private readonly imageStorage?: ImageStoragePort,
  ) {}

  async getBoard(c: Context<{ Variables: AppVariables }>, slide: number) {
    const viewer = c.get('user')?.user_id ?? null;
    const board = await this.uc.getBoard(slide, viewer);
    return c.json({ success: true as const, data: serializeBoard(board) });
  }

  async getKosakataStats(c: Context<{ Variables: AppVariables }>) {
    const stats = await this.uc.getKosakataStats();
    return c.json({
      success: true as const,
      data: {
        total: stats.total,
        verified: stats.verified,
        queue: stats.queue,
        rejected: stats.rejected,
      },
    });
  }

  async getPricing(c: Context<{ Variables: AppVariables }>) {
    const pricing = await this.uc.getPricing();
    return c.json({
      success: true as const,
      data: {
        price_per_cell_per_day: pricing.pricePerCellPerDay,
        currency: 'IDR',
      },
    });
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
      startsOn: body.starts_on,
      confirmationPhone: body.confirmation_phone,
      creativeId: body.creative_id,
      frames: body.frames.map((f) => ({
        mediaType: f.media_type,
        mediaUrl: f.media_url,
        title: f.title,
        body: f.body,
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

  async listMyCreatives(c: Context<{ Variables: AppVariables }>) {
    const userId = c.get('user')!.user_id;
    const rows = await this.uc.listMyCreatives(userId);
    return c.json({
      success: true as const,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          fingerprint: r.fingerprint,
          title: r.title,
          media_url: r.mediaUrl,
          frame_count: r.frameCount,
          last_referral_username: r.lastReferralUsername,
        })),
      },
    });
  }

  async listMyPlacements(c: Context<{ Variables: AppVariables }>) {
    const userId = c.get('user')!.user_id;
    const rows = await this.uc.listMyPlacements(userId);
    return c.json({
      success: true as const,
      data: {
        items: rows.map((r) => {
          const perf = deriveBalehoPerfMetrics({
            counts: {
              impressions: r.impressions,
              taps: r.taps,
              actions: r.actions,
              actionSuccess: r.actionSuccess,
              actionFail: r.actionFail,
            },
            quotedAmount: r.quotedAmount,
            daily: r.daily,
          });
          return {
            id: r.id,
            slide: r.slide,
            col: r.col,
            row: r.row,
            w: r.w,
            h: r.h,
            status: r.status,
            title: r.title,
            media_url: r.mediaUrl,
            created_at: r.createdAt.toISOString(),
            ends_at: r.endsAt?.toISOString() ?? null,
            ...perf,
          };
        }),
      },
    });
  }

  async adminList(c: Context<{ Variables: AppVariables }>) {
    const rows = await this.uc.listAdmin(100);
    return c.json({
      success: true as const,
      data: rows.map((r) => {
        const perf = deriveBalehoPerfMetrics({
          counts: {
            impressions: r.impressions,
            taps: r.taps,
            actions: r.actions,
            actionSuccess: r.actionSuccess,
            actionFail: r.actionFail,
          },
          quotedAmount: r.quotedAmount,
          daily: r.daily,
        });
        const days = r.days ?? 30;
        const scheduledStartsOn = r.scheduledStartsOn
          ? formatBalehoStartsOn(r.scheduledStartsOn)
          : null;
        const scheduledEndsOn = r.scheduledStartsOn
          ? formatBalehoStartsOn(computeEndsAtFromWindow(r.scheduledStartsOn, days))
          : null;
        return {
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
          confirmation_phone: r.confirmationPhone,
          scheduled_starts_on: scheduledStartsOn,
          scheduled_ends_on: scheduledEndsOn,
          starts_at: r.startsAt?.toISOString() ?? null,
          // Raw ImageKit URL tidak diekspos - preview lewat GET .../payment-proof.
          has_payment_proof: Boolean(r.paymentProofUrl?.trim()),
          price_per_cell_per_day: r.pricePerCellPerDay,
          days: r.days,
          created_at: r.createdAt.toISOString(),
          ends_at: r.endsAt?.toISOString() ?? null,
          ...perf,
        };
      }),
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
    body: MarkPaidBody,
  ) {
    await this.uc.markPaid(placementId, {
      paymentProofUrl: body.payment_proof_url,
      paymentProofFileId: body.payment_proof_file_id,
    });
    return c.json({ success: true as const, data: { id: placementId } });
  }

  /**
   * Stream bukti bayar - hanya root/admin. Client fetch dengan Bearer,
   * tampilkan sebagai blob di popup (jangan buka URL CDN mentah).
   */
  async adminPaymentProof(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
  ) {
    const user = c.get('user');
    const allowed = user?.roles.some((r) => PAYMENT_PROOF_ROLES.has(r)) ?? false;
    if (!allowed) {
      throw new ForbiddenError(
        'FORBIDDEN',
        'Bukti pembayaran hanya bisa dilihat admin.',
      );
    }
    if (!this.imageStorage) {
      throw new ServiceUnavailableError(
        'IMAGE_PROXY_UNAVAILABLE',
        'Proxy gambar belum siap',
      );
    }
    const url = await this.uc.getPaymentProofUrl(placementId);
    const file = await this.imageStorage.fetchAuthenticatedFile(url);
    return new Response(file.bytes, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  async adminPause(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
    body: RejectBody,
  ) {
    await this.uc.pause(placementId, body.reason);
    return c.json({ success: true as const, data: { id: placementId } });
  }

  async adminResume(
    c: Context<{ Variables: AppVariables }>,
    placementId: string,
  ) {
    await this.uc.resume(placementId);
    return c.json({ success: true as const, data: { id: placementId } });
  }
}
