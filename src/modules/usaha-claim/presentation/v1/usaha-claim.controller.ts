import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { UsahaClaimUseCases } from '../../application/usaha-claim.use-cases';
import type {
  UsahaClaim,
  UsahaClaimWithUsaha,
} from '../../domain/usaha-claim.entity';
import type {
  listClaimsQuerySchema,
} from './validators/usaha-claim.validator';

/** Wire publik - TANPA contact_evidence. */
function serializePublic(r: UsahaClaim | UsahaClaimWithUsaha) {
  const withUsaha = r as UsahaClaimWithUsaha;
  return {
    id: r.id,
    usaha_id: r.usahaId,
    usaha_slug: withUsaha.usahaSlug,
    usaha_name: withUsaha.usahaName,
    note: r.note,
    status: r.status,
    reject_reason_code: r.rejectReasonCode,
    reject_reason_text: r.rejectReasonText,
    created_at: r.createdAt.toISOString(),
    reviewed_at: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

/** Wire admin - bukti klaim ikut (antrean moderasi saja). */
function serializeAdmin(r: UsahaClaim | UsahaClaimWithUsaha) {
  const withUsaha = r as UsahaClaimWithUsaha;
  return {
    ...serializePublic(r),
    usaha_slug: withUsaha.usahaSlug,
    usaha_name: withUsaha.usahaName,
    contact_evidence: r.contactEvidence,
    user_id: r.userId,
    reviewed_by: r.reviewedBy,
  };
}

export class UsahaClaimController {
  constructor(private readonly uc: UsahaClaimUseCases) {}

  submit(
    c: Context<{ Variables: AppVariables }>,
    slug: string,
    body: { contact_evidence: string; note?: string | null },
  ) {
    return this.uc
      .submit(c.get('user')?.user_id ?? '', slug, {
        contactEvidence: body.contact_evidence,
        note: body.note,
      })
      .then((r) => c.json({ success: true as const, data: serializePublic(r) }));
  }

  mine(c: Context<{ Variables: AppVariables }>) {
    return this.uc
      .mine(c.get('user')?.user_id ?? '')
      .then((items) =>
        c.json({
          success: true as const,
          data: { items: items.map(serializePublic) },
        }),
      );
  }

  cancel(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .cancel(c.get('user')?.user_id ?? '', id)
      .then(() => c.json({ success: true as const, data: null }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listClaimsQuerySchema>,
  ) {
    return this.uc
      .listForAdmin(query.status)
      .then((items) =>
        c.json({
          success: true as const,
          data: { items: items.map(serializeAdmin) },
        }),
      );
  }

  approve(c: Context<{ Variables: AppVariables }>, id: string) {
    return this.uc
      .approve(
        id,
        c.get('user')?.user_id ?? '',
        c.get('requestId') ?? null,
      )
      .then(() => c.json({ success: true as const, data: null }));
  }

  reject(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: { reason_code: string; reason_text?: string | null },
  ) {
    return this.uc
      .reject(
        id,
        body.reason_code,
        body.reason_text,
        c.get('user')?.user_id ?? '',
        c.get('requestId') ?? null,
      )
      .then(() => c.json({ success: true as const, data: null }));
  }
}
