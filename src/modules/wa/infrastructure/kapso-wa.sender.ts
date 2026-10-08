import { env } from "@/shared/config/env";
import { logger } from "@/shared/logging/logger";
import type {
  WaSendCommand,
  WaSenderPort,
} from "../application/ports/wa-sender.port";

/**
 * Provider WhatsApp via Kapso (proxy Meta WhatsApp Cloud API).
 * Kirim = POST {baseUrl}/{phoneNumberId}/messages, header X-API-KEY.
 * Tanpa dependency SDK - fetch cukup (docs/env/kapso.md).
 */
/** Base URL Kapso WA berversi (path lama tanpa versi = 404 HTML). */
export const KAPSO_WA_DEFAULT_BASE_URL =
  "https://api.kapso.ai/meta/whatsapp/v24.0";

export class KapsoWaSender implements WaSenderPort {
  readonly provider = "kapso";

  private readonly baseUrl: string;
  private readonly phoneNumberId: string | undefined;

  constructor(opts?: { baseUrl?: string; phoneNumberId?: string }) {
    this.baseUrl =
      opts?.baseUrl ?? env.KAPSO_BASE_URL ?? KAPSO_WA_DEFAULT_BASE_URL;
    this.phoneNumberId = opts?.phoneNumberId ?? env.KAPSO_PHONE_NUMBER_ID;
  }

  isConfigured(): boolean {
    return Boolean(env.KAPSO_API_KEY && env.KAPSO_PHONE_NUMBER_ID);
  }

  async send(cmd: WaSendCommand): Promise<void> {
    const payload =
      cmd.channel === "template"
        ? {
            messaging_product: "whatsapp",
            to: cmd.to,
            type: "template",
            template: {
              name: cmd.templateName,
              language: { code: cmd.language ?? "id" },
              components: [
                {
                  type: "body",
                  parameters: (cmd.positionalParams ?? []).map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ],
            },
          }
        : {
            messaging_product: "whatsapp",
            to: cmd.to,
            type: "text",
            text: { body: cmd.bodyText ?? "" },
          };

    const res = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "X-API-KEY": env.KAPSO_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.warn(
        { status: res.status, body: errBody.slice(0, 500), to: cmd.to },
        "kapso wa send failed",
      );
      throw new Error(
        `Kapso WA gagal (HTTP ${res.status}): ${errBody.slice(0, 300)}`,
      );
    }
    logger.info({ to: cmd.to, channel: cmd.channel }, "kapso wa send ok");
  }
}
