import type { Context } from 'hono';
import {
  clientIpKey,
  normalizedDeviceId,
} from '@/shared/middlewares/rate-limit.middleware';
import type { AppVariables } from '@/shared/types';

/** Kunci dedupe view harian: user login > device id > IP. */
export function viewerKey(c: Context<{ Variables: AppVariables }>): string {
  const userId = c.get('user')?.user_id;
  if (userId) return `u:${userId}`;
  const deviceId = normalizedDeviceId(c);
  if (deviceId) return `d:${deviceId}`;
  return `ip:${clientIpKey(c)}`;
}