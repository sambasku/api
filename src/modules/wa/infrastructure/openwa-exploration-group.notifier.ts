import type { UserRepository } from "@/modules/auth/domain/repositories/user.repository";
import { ANONIM_USER_ID } from "@/shared/constants/anonim";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/logging/logger";
import type { WaMessageLogRepository } from "../domain/repositories/wa-message.repository";
import {
  formatExplorationGroupMessage,
  type ExplorationGroupNotice,
  type ExplorationGroupNotifier,
} from "../application/ports/exploration-group-notifier.port";

export const EXPLORATION_GROUP_EVENT_KEY = "exploration_proposal_submitted";

export interface OpenWaGatewayConfig {
  baseUrl?: string;
  apiKey?: string;
  sessionId?: string;
  groupJid?: string;
}

export function openWaConfigFromEnv(): OpenWaGatewayConfig {
  return {
    baseUrl: env.OPENWA_BASE_URL,
    apiKey: env.OPENWA_API_KEY,
    sessionId: env.OPENWA_SESSION_ID,
    groupJid: env.OPENWA_GROUP_JID,
  };
}

export function readyOpenWaConfig(
  config: OpenWaGatewayConfig,
): Required<OpenWaGatewayConfig> | null {
  const baseUrl = config.baseUrl?.trim().replace(/\/$/, "");
  const apiKey = config.apiKey?.trim();
  const sessionId = config.sessionId?.trim();
  const groupJid = config.groupJid?.trim();
  if (!baseUrl || !apiKey || !sessionId || !groupJid) return null;
  return { baseUrl, apiKey, sessionId, groupJid };
}

/** POST {base}/api/sessions/{sessionId}/messages/send-text */
export async function sendOpenWaText(
  config: Required<Pick<OpenWaGatewayConfig, "baseUrl" | "apiKey" | "sessionId">>,
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(
    `${config.baseUrl}/api/sessions/${config.sessionId}/messages/send-text`,
    {
      method: "POST",
      headers: {
        "X-API-Key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatId, text }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWA gagal (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Kirim teks ke grup lewat gateway OpenWA.
 * POST {base}/api/sessions/{sessionId}/messages/send-text
 */
export class OpenWaExplorationGroupNotifier implements ExplorationGroupNotifier {
  constructor(
    private readonly users: Pick<UserRepository, "findById">,
    private readonly logs: Pick<WaMessageLogRepository, "record">,
    private readonly config: OpenWaGatewayConfig = openWaConfigFromEnv(),
  ) {}

  async notify(notice: ExplorationGroupNotice): Promise<void> {
    const config = readyOpenWaConfig(this.config);
    if (!config) return;

    const text = formatExplorationGroupMessage({
      jenis: notice.jenis,
      name: notice.name,
      from: await this.fromLabel(notice.userId),
      resubmit: notice.resubmit,
    });

    try {
      await sendOpenWaText(config, config.groupJid, text);
      await this.record(config.groupJid, "sent", null);
      logger.info(
        { jenis: notice.jenis, resubmit: Boolean(notice.resubmit) },
        "openwa exploration group send ok",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.record(config.groupJid, "failed", message);
      logger.warn(
        { jenis: notice.jenis, error: message },
        "openwa exploration group send failed",
      );
    }
  }

  private async fromLabel(userId: string): Promise<string> {
    if (userId === ANONIM_USER_ID) return "Anonim";
    try {
      const user = await this.users.findById(userId);
      if (user?.username) return `@${user.username}`;
    } catch {
      // Lookup gagal: pesan tetap terkirim.
    }
    return "pengguna";
  }

  private async record(
    groupJid: string,
    status: "sent" | "failed",
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.logs.record({
        provider: "openwa",
        eventKey: EXPLORATION_GROUP_EVENT_KEY,
        toPhone: groupJid,
        templateName: null,
        channel: "text",
        status,
        errorMessage,
      });
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        "openwa exploration group log failed",
      );
    }
  }
}
