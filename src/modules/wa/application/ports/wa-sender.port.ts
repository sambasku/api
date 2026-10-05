import type { WaChannel } from '../../domain/entities/wa-message.entity';

export interface WaSendCommand {
  channel: WaChannel;
  to: string;
  templateName?: string;
  language?: string;
  /** Parameter positional sesuai urutan komponen body template Meta. */
  positionalParams?: string[];
  bodyText?: string;
}

/**
 * Port pengiriman WhatsApp. Satu impl per provider (Kapso, dll).
 * Routing antar provider (fallback saat quota habis) ditangani WaProviderRouter.
 */
export interface WaSenderPort {
  readonly provider: string;
  send(cmd: WaSendCommand): Promise<void>;
}
