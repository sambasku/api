import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import {
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import { opaqueId } from '@/shared/validation/id';
import type { WordRepository } from '../../domain/repositories/word.repository';
import {
  GetWordOfDayUseCase,
  wordOfDaySettingKey,
  wibDateString,
} from './get-word-of-day.use-case';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(raw: string): string {
  const date = raw.trim();
  if (!DATE_RE.test(date)) {
    throw new ValidationError([
      { field: 'date', message: 'Tanggal harus format YYYY-MM-DD (WIB)' },
    ]);
  }
  return date;
}

function parseDateFromKey(key: string): string | null {
  const prefix = 'word_of_the_day:';
  if (!key.startsWith(prefix)) return null;
  const date = key.slice(prefix.length);
  return DATE_RE.test(date) ? date : null;
}

export type WordOfDayAdminSource = 'manual' | 'algorithm' | 'empty';

export interface WordOfDayAdminView {
  date: string;
  wordId: string | null;
  lemma: string | null;
  source: WordOfDayAdminSource;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface WordOfDayHistoryRow {
  date: string;
  wordId: string;
  lemma: string | null;
  source: WordOfDayAdminSource;
  updatedAt: string | null;
  updatedBy: string | null;
}

export class GetAdminWordOfDayUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly settingsRepo: AppSettingsRepository,
  ) {}

  async execute(dateInput?: string): Promise<WordOfDayAdminView> {
    const date = assertDate(dateInput ?? wibDateString(new Date()));
    const key = wordOfDaySettingKey(date);
    const rows = await this.settingsRepo.getByKeys([key]);
    const row = rows[0];

    let wordId: string | null = row?.value ?? null;
    let source: WordOfDayAdminSource = 'empty';

    if (wordId) {
      source = row?.updatedBy ? 'manual' : 'algorithm';
    } else {
      const computed = await this.wordRepo.findWordOfDayId(date);
      wordId = computed;
      if (wordId) source = 'algorithm';
    }

    let lemma: string | null = null;
    if (wordId) {
      const map = await this.wordRepo.findLemmaByIds([wordId]);
      lemma = map.get(wordId)?.lemma ?? null;
    }

    return {
      date,
      wordId,
      lemma,
      source,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  }
}

export class ListAdminWordOfDayHistoryUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly settingsRepo: AppSettingsRepository,
  ) {}

  async execute(limit = 30): Promise<WordOfDayHistoryRow[]> {
    const rows = await this.settingsRepo.listByKeyPrefix('word_of_the_day:', limit);
    const ids = rows.map((r) => r.value);
    const lemmas = await this.wordRepo.findLemmaByIds(ids);
    const out: WordOfDayHistoryRow[] = [];
    for (const row of rows) {
      const date = parseDateFromKey(row.key);
      if (!date) continue;
      out.push({
        date,
        wordId: row.value,
        lemma: lemmas.get(row.value)?.lemma ?? null,
        source: row.updatedBy ? 'manual' : 'algorithm',
        updatedAt: row.updatedAt?.toISOString() ?? null,
        updatedBy: row.updatedBy,
      });
    }
    return out;
  }
}

export class SetAdminWordOfDayUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly settingsRepo: AppSettingsRepository,
    private readonly getWordOfDay: GetWordOfDayUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(input: {
    date: string;
    wordId: string;
    actorId: string;
  }): Promise<WordOfDayAdminView> {
    const date = assertDate(input.date);
    const parsedId = opaqueId.safeParse(input.wordId.trim());
    if (!parsedId.success) {
      throw new ValidationError([
        {
          field: 'word_id',
          message: 'Data tidak valid. Pilih kata dari daftar, lalu coba lagi.',
        },
      ]);
    }
    const wordId = parsedId.data;
    const word = await this.wordRepo.findById(wordId);
    if (!word || word.status !== 'published' || word.deletedAt) {
      throw new ValidationError([
        { field: 'word_id', message: 'Kata harus terbit dan ada di kamus' },
      ]);
    }

    const key = wordOfDaySettingKey(date);
    await this.settingsRepo.upsertMany(
      [
        {
          key,
          value: wordId,
          type: 'string',
          description: 'Pilihan kata hari ini (WIB)',
        },
      ],
      input.actorId,
    );
    this.getWordOfDay.invalidateCache();

    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'update',
      entityType: 'word_of_day',
      entityId: date,
      newData: { word_id: wordId, lemma: word.lemma },
    });

    return {
      date,
      wordId,
      lemma: word.lemma,
      source: 'manual',
      updatedAt: new Date().toISOString(),
      updatedBy: input.actorId,
    };
  }
}

export class ClearAdminWordOfDayUseCase {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly getWordOfDay: GetWordOfDayUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(input: { date: string; actorId: string }): Promise<void> {
    const date = assertDate(input.date);
    const key = wordOfDaySettingKey(date);
    const existing = await this.settingsRepo.getValue(key);
    if (!existing) {
      throw new NotFoundError(
        'WORD_OF_DAY_NOT_SET',
        'Belum ada pilihan tersimpan untuk tanggal itu',
      );
    }
    await this.settingsRepo.deleteKey(key);
    this.getWordOfDay.invalidateCache();
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'delete',
      entityType: 'word_of_day',
      entityId: date,
      oldData: { word_id: existing },
    });
  }
}