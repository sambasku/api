export interface WaTemplateParam {
  name: string;
  description: string;
}

export interface WaMessageTemplate {
  id: string;
  eventKey: string;
  enabled: boolean;
  metaTemplateName: string;
  metaTemplateLanguage: string;
  body: string;
  params: WaTemplateParam[];
  updatedAt: Date | null;
  updatedBy: string | null;
}

export type WaChannel = 'template' | 'text';
export type WaLogStatus = 'sent' | 'failed';

export interface WaMessageLog {
  id: string;
  provider: string;
  eventKey: string;
  toPhone: string;
  templateName: string | null;
  channel: WaChannel;
  status: WaLogStatus;
  errorMessage: string | null;
  createdAt: Date;
}

export interface WaUsage {
  provider: string;
  usedCount: number;
  limitCount: number;
  warnThresholdPercent: number;
  periodStart: Date;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface WaSendResult {
  ok: boolean;
  provider: string;
  errorMessage?: string;
}

/** Nama provider aktif - urutan = urutan fallback routing. */
export const WA_PROVIDERS = ['kapso'] as const;
export type WaProvider = (typeof WA_PROVIDERS)[number];

export const DEFAULT_WA_MONTHLY_LIMIT = 2000;
