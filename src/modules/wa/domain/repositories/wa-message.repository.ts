import type {
  WaMessageLog,
  WaMessageTemplate,
  WaTemplateParam,
  WaUsage,
} from '../entities/wa-message.entity';

export interface WaTemplateUpdateInput {
  enabled?: boolean;
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
  body?: string;
  params?: WaTemplateParam[];
}

export interface WaUsageUpdateInput {
  usedCount?: number;
  limitCount?: number;
  warnThresholdPercent?: number;
}

export interface WaLogListQuery {
  limit?: number;
  cursor?: string | null;
}

export interface WaTemplateCreateInput {
  eventKey: string;
  enabled: boolean;
  metaTemplateName: string;
  metaTemplateLanguage: string;
  body: string;
  params: WaTemplateParam[];
}

export interface WaTemplateRepository {
  list(): Promise<WaMessageTemplate[]>;
  /** Buat template event baru (console #31) - event_key unik, 409 saat bentrok. */
  create(input: WaTemplateCreateInput, actorId: string): Promise<WaMessageTemplate>;
  getByKey(eventKey: string): Promise<WaMessageTemplate | null>;
  update(id: string, input: WaTemplateUpdateInput, actorId: string): Promise<WaMessageTemplate>;
}

export interface WaMessageLogRepository {
  record(entry: Omit<WaMessageLog, 'id' | 'createdAt'>): Promise<void>;
  list(query: WaLogListQuery): Promise<{ items: WaMessageLog[]; nextCursor: string | null }>;
}

export interface WaUsageRepository {
  /**
   * Ambil usage provider; reset used_count ke 0 kalau period_start bukan
   * bulan berjalan (lazy reset bulanan, jaring pengaman cron).
   */
  getActive(provider: string): Promise<WaUsage>;
  increment(provider: string, by?: number): Promise<WaUsage>;
  setUsage(provider: string, input: WaUsageUpdateInput, actorId: string): Promise<WaUsage>;
}
