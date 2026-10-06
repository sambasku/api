import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import {
  DEFAULT_WA_GROUP_CTA_URL,
  WA_GROUP_CTA_URL_KEY,
  WA_VERIFIER_ENABLED_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type { WaTemplateParam } from '../../domain/entities/wa-message.entity';
import type {
  WaMessageLogRepository,
  WaTemplateRepository,
  WaUsageRepository,
} from '../../domain/repositories/wa-message.repository';
import type { WaSendCommand, WaSenderPort } from '../ports/wa-sender.port';
import { BadRequestError } from '@/shared/errors/app-error';

export type WaSenderPortWithConfigured = WaSenderPort & { isConfigured?: () => boolean };

export interface SendWaMessageCommand {
  /** Slug event: verifier_application_approved | verifier_application_rejected | test. */
  eventKey: string;
  toPhone: string;
  channel: 'template' | 'text';
  /** Wajib untuk channel=template: params bernama di-render dari urutan params template. */
  template?: { eventKey: string; params: Record<string, string> };
  /** Wajib untuk channel=text: teks mentah (test send admin). */
  bodyText?: string;
  /** Pencatat log untuk channel=text (mis. nama template sumber test). */
  templateName?: string;
}

export interface SendWaMessageResult {
  sent: boolean;
  reason?: string;
}

/** Render {{param}} bernama - unknown placeholder dibiarkan apa adanya. */
export function renderWaBody(body: string, params: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => params[name] ?? match);
}

/** Urutan positional = urutan params di template (kontrak Meta). */
export function toPositionalParams(
  params: WaTemplateParam[],
  values: Record<string, string>,
): string[] {
  return params.map((p) => values[p.name] ?? '');
}

/** Format nomor WA internasional tanpa `+` (kontrak sama verifier-applications). */
export function isValidWaPhone(phone: string): boolean {
  return /^[1-9]\d{7,14}$/.test(phone);
}

export class SendWaMessageUseCase {
  constructor(
    private readonly senders: WaSendGatewayEntry[],
    private readonly usageRepo: WaUsageRepository,
    private readonly logRepo: WaMessageLogRepository,
    private readonly templateRepo: WaTemplateRepository,
    private readonly settingsRepo: AppSettingsRepository,
  ) {}

  async execute(cmd: SendWaMessageCommand): Promise<SendWaMessageResult> {
    const configured = this.senders.filter((s) => s.sender.isConfigured?.() ?? true);
    if (configured.length === 0) {
      return { sent: false, reason: 'WA sender belum dikonfigurasi (KAPSO_* env kosong)' };
    }
    // Semua jalur kirim (approve/reject/test) wajib nomor valid - Meta
    // menolak nomor malformed, jangan buang percobaan quota.
    if (!isValidWaPhone(cmd.toPhone)) {
      return { sent: false, reason: 'Nomor HP tidak valid (harus internasional tanpa +)' };
    }

    let templateName: string | null = null;
    let language = 'id';
    let positional: string[] = [];

    if (cmd.channel === 'template') {
      const tpl = await this.templateRepo.getByKey(cmd.template!.eventKey);
      if (!tpl) {
        return { sent: false, reason: `Template tidak ditemukan: ${cmd.template!.eventKey}` };
      }
      if (!tpl.enabled) return { sent: false, reason: `Template ${tpl.eventKey} nonaktif` };
      templateName = tpl.metaTemplateName;
      language = tpl.metaTemplateLanguage;
      positional = toPositionalParams(tpl.params, cmd.template!.params);
      // Param wajib kosong = Meta menolak template → skip, jangan buang quota.
      const missing = tpl.params
        .map((p, i) => ({ name: p.name, value: positional[i] ?? '' }))
        .filter((p) => !p.value.trim())
        .map((p) => p.name);
      if (missing.length > 0) {
        return { sent: false, reason: `Parameter template kosong: ${missing.join(', ')}` };
      }
      // Meta batasi body template 1024 char.
      if (positional.join('').length > 1024) {
        return { sent: false, reason: 'Total isi parameter melebihi 1024 karakter (batas Meta)' };
      }
    }

    const message: WaSendCommand =
      cmd.channel === 'template'
        ? {
            channel: 'template',
            to: cmd.toPhone,
            templateName: templateName!,
            language,
            positionalParams: positional,
          }
        : { channel: 'text', to: cmd.toPhone, bodyText: cmd.bodyText! };

    let lastError = '';
    for (const entry of configured) {
      // Quota check per provider: habis → pindah provider (routing).
      let exhausted = false;
      try {
        const usage = await this.usageRepo.getActive(entry.sender.provider);
        exhausted = usage.usedCount >= usage.limitCount;
      } catch {
        exhausted = true;
      }
      if (exhausted) {
        lastError = `Quota provider ${entry.sender.provider} habis`;
        continue;
      }

      try {
        await entry.sender.send(message);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        await this.logRepo.record({
          provider: entry.sender.provider,
          eventKey: cmd.eventKey,
          toPhone: cmd.toPhone,
          templateName,
          channel: cmd.channel,
          status: 'failed',
          errorMessage: lastError,
        });
        continue;
      }

      await this.usageRepo.increment(entry.sender.provider, 1);
      await this.logRepo.record({
        provider: entry.sender.provider,
        eventKey: cmd.eventKey,
        toPhone: cmd.toPhone,
        templateName,
        channel: cmd.channel,
        status: 'sent',
        errorMessage: null,
      });
      return { sent: true };
    }

    await this.logRepo.record({
      provider: configured[0]?.sender.provider ?? 'kapso',
      eventKey: cmd.eventKey,
      toPhone: cmd.toPhone,
      templateName,
      channel: cmd.channel,
      status: 'failed',
      errorMessage: lastError || 'Tidak ada provider WA tersedia',
    });
    return { sent: false, reason: lastError || 'Tidak ada provider WA tersedia' };
  }

  /** Baca flag + CTA URL dari app_settings (dipakai pemanggil notif verifikator). */
  async readWaSettings(): Promise<{ enabled: boolean; ctaUrl: string }> {
    const rows = await this.settingsRepo.getByKeys([WA_VERIFIER_ENABLED_KEY, WA_GROUP_CTA_URL_KEY]);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      enabled: map[WA_VERIFIER_ENABLED_KEY]?.toLowerCase() === 'true',
      ctaUrl: map[WA_GROUP_CTA_URL_KEY] || DEFAULT_WA_GROUP_CTA_URL,
    };
  }

  /** Admin test send: kirim raw body template tanpa render, lewat quota + log. */
  async sendTest(phone: string, rawBody: string, templateName: string): Promise<SendWaMessageResult> {
    if (!isValidWaPhone(phone)) {
      throw new BadRequestError('VALIDATION_ERROR', 'Nomor HP harus format internasional tanpa +', [
        { field: 'phone', message: 'Contoh: 6281234567890' },
      ]);
    }
    return this.execute({
      eventKey: 'test',
      toPhone: phone,
      channel: 'text',
      bodyText: rawBody,
      templateName,
    });
  }
}

interface WaSendGatewayEntry {
  sender: WaSenderPortWithConfigured;
}
