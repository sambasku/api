import { logger } from "@/shared/logging/logger";
import type {
  WaSendCommand,
  WaSenderPort,
} from "../application/ports/wa-sender.port";
import {
  openWaConfigFromEnv,
  readyOpenWaConfig,
  sendOpenWaText,
  type OpenWaGatewayConfig,
} from "./openwa-exploration-group.notifier";

/**
 * Kirim teks lewat gateway OpenWA. Nomor internasional tanpa `+`
 * jadi chat id `{nomor}@c.us`. JID yang sudah berisi `@` dipakai apa adanya.
 */
export class OpenWaSender implements WaSenderPort {
  readonly provider = "openwa";

  constructor(
    private readonly config: OpenWaGatewayConfig = openWaConfigFromEnv(),
  ) {}

  isConfigured(): boolean {
    return readyOpenWaConfig(this.config) !== null;
  }

  async send(cmd: WaSendCommand): Promise<void> {
    const config = readyOpenWaConfig(this.config);
    if (!config) throw new Error("OpenWA belum dikonfigurasi");
    const text = cmd.bodyText ?? "";
    if (!text.trim()) throw new Error("Isi pesan WA kosong");
    const chatId = cmd.to.includes("@") ? cmd.to : `${cmd.to}@c.us`;
    await sendOpenWaText(config, chatId, text);
    logger.info({ to: chatId }, "openwa send ok");
  }
}
