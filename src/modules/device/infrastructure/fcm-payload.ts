import type { PushMessage } from '../application/ports/push-sender.port';

export type FcmTarget = { token: string } | { topic: string };

/**
 * Bangun payload FCM HTTP v1 lintas platform (Android + iOS APNs).
 * - Android: notification + optional android.notification.image. Jangan set
 *   android.channel_id agar background notif memakai channel default FCM;
 *   channel AwesomeNotifications (`sambasku_notifications`) hanya untuk foreground.
 * - iOS (APNs): headers alert/priority 10, aps.sound default, mutable-content
 *   + fcm_options.image saat ada gambar.
 */
export function buildFcmMessagePayload(target: FcmTarget, message: PushMessage) {
  const data: Record<string, string> = {
    ...(message.data ?? {}),
    ...(message.bodyType ? { body_type: message.bodyType } : {}),
  };

  return {
    message: {
      ...target,
      notification: {
        title: message.title,
        body: message.body,
        ...(message.imageUrl ? { image: message.imageUrl } : {}),
      },
      ...(message.imageUrl
        ? { android: { notification: { image: message.imageUrl } } }
        : {}),
      apns: {
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            ...(message.imageUrl ? { 'mutable-content': 1 } : {}),
          },
        },
        ...(message.imageUrl ? { fcm_options: { image: message.imageUrl } } : {}),
      },
      ...(Object.keys(data).length > 0 ? { data } : {}),
    },
  };
}
