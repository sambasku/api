import { logger } from '@/shared/logging/logger';
import { getGoogleAccessToken } from '@/shared/google/service-account-token';
import type { PushMessage, PushSendResult, PushSenderPort } from '../application/ports/push-sender.port';
import { buildFcmMessagePayload } from './fcm-payload';

export { buildFcmMessagePayload, type FcmTarget } from './fcm-payload';

function getFcmAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  return getGoogleAccessToken({ clientEmail, privateKey }, 'https://www.googleapis.com/auth/firebase.messaging');
}

async function pushOne(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  message: PushMessage,
): Promise<boolean> {
  const payload = buildFcmMessagePayload({ token: fcmToken }, message);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (res.ok) {
    logger.info({ token_prefix: fcmToken.slice(0, 16) }, 'fcm push ok');
    return true;
  }
  const errBody = await res.text();
  logger.warn(
    { status: res.status, body: errBody, token_prefix: fcmToken.slice(0, 16) },
    'fcm push failed',
  );
  return false;
}

async function pushTopic(
  accessToken: string,
  projectId: string,
  topic: string,
  message: PushMessage,
): Promise<boolean> {
  const payload = buildFcmMessagePayload({ topic }, message);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (res.ok) {
    logger.info({ topic }, 'fcm topic push ok');
    return true;
  }
  const errBody = await res.text();
  logger.warn({ status: res.status, body: errBody, topic }, 'fcm topic push failed');
  return false;
}

export class FcmPushSender implements PushSenderPort {
  readonly isConfigured = true;

  constructor(
    private readonly projectId: string,
    private readonly clientEmail: string,
    private readonly privateKey: string,
  ) {}

  async send(fcmTokens: string[], message: PushMessage): Promise<PushSendResult> {
    if (fcmTokens.length === 0) return { success: [], failed: [] };
    const accessToken = await getFcmAccessToken(this.clientEmail, this.privateKey);
    const outcomes = await Promise.all(
      fcmTokens.map((token) =>
        pushOne(accessToken, this.projectId, token, message).then((ok) =>
          ok ? token : null,
        ),
      ),
    );
    const success = outcomes.filter((t): t is string => t !== null);
    const failed = fcmTokens.filter((t) => !success.includes(t));
    return { success, failed };
  }

  async sendToTopic(topic: string, message: PushMessage): Promise<boolean> {
    const accessToken = await getFcmAccessToken(this.clientEmail, this.privateKey);
    return pushTopic(accessToken, this.projectId, topic, message);
  }
}

/** No-op bila FIREBASE_* belum di-set - boot tetap aman. */
export class NoopPushSender implements PushSenderPort {
  readonly isConfigured = false;

  async send(fcmTokens: string[], _message: PushMessage): Promise<PushSendResult> {
    return { success: [], failed: [...fcmTokens] };
  }

  async sendToTopic(_topic: string, _message: PushMessage): Promise<boolean> {
    return false;
  }
}
