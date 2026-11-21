import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';

/**
 * Welcome feed `user_joined` (wire: welcome). Dedupe per user - aman
 * dipanggil dari verify-email, admin verify, dan OAuth create (#285).
 */
export async function emitUserJoined(
  activityEvents: RecordActivityEventUseCase | undefined,
  userId: string,
  occurredAt?: Date,
): Promise<void> {
  await activityEvents?.safe({
    kind: 'user_joined',
    actorId: userId,
    targetId: userId,
    dedupeKey: `joined:${userId}`,
    ...(occurredAt ? { occurredAt } : {}),
  });
}
