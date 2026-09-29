import { BadRequestError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { generateId } from '@/shared/utils/ulid';
import type { LanguageRepository } from '@/modules/language/domain/repositories/language.repository';
import { assertUgcTextQualityWithAnonStrike } from '@/shared/moderation/assert-ugc-text-quality-with-anon-strike';
import type { RecordAnonAbuseSignalUseCase } from '@/shared/moderation/record-anon-abuse-signal.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { WordImportSessionRepository } from '../../domain/repositories/word-import-session.repository';
import type { WordImportSessionItem } from '../../domain/entities/word-import-session.entity';
import {
  meaningFingerprint,
  preparedMeaning,
  type ImportWordResult,
} from '../import-words';

export const BATCH_CONTRIBUTE_MAX_ROWS = 50;
export const BATCH_CONTRIBUTE_SOURCE_LABEL = 'Kontribusi massal web';

export type BatchContributeRow = {
  sambas: string;
  indonesia: string;
};

export type BatchContributeResult = {
  session_id: string;
  total: number;
  created_count: number;
  duplicates_count: number;
  meanings_added_count: number;
  invalid_count: number;
  items: ImportWordResult[];
};

/**
 * Input massal publik: langsung tayang + tercatat di word_import_sessions.
 * Atribusi creator selalu Anonim; nama opsional disimpan di support_name.
 */
export class BatchContributeWordsUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly languageRepo: LanguageRepository,
    private readonly sessionRepo: WordImportSessionRepository,
    private readonly anonAbuse?: RecordAnonAbuseSignalUseCase,
  ) {}

  async execute(input: {
    rows: BatchContributeRow[];
    contributorName?: string | null;
    triggeredBy: string;
    clientIp?: string | null;
    deviceId?: string | null;
  }): Promise<BatchContributeResult> {
    if (input.rows.length === 0) {
      throw new BadRequestError('BATCH_EMPTY', 'Minimal satu baris kata harus diisi');
    }
    if (input.rows.length > BATCH_CONTRIBUTE_MAX_ROWS) {
      throw new BadRequestError(
        'BATCH_TOO_LARGE',
        `Maksimal ${BATCH_CONTRIBUTE_MAX_ROWS} kata per kiriman`,
      );
    }

    const clientIp = input.clientIp?.trim() || 'unknown';
    const deviceId = input.deviceId ?? null;
    for (const [i, row] of input.rows.entries()) {
      await assertUgcTextQualityWithAnonStrike(row.sambas, {
        clientIp,
        deviceId,
        abuse: this.anonAbuse,
        entityType: 'word_batch',
        field: `rows.${i}.sambas`,
        minMeaningfulChars: 1,
      });
      await assertUgcTextQualityWithAnonStrike(row.indonesia, {
        clientIp,
        deviceId,
        abuse: this.anonAbuse,
        entityType: 'word_batch',
        field: `rows.${i}.indonesia`,
        minMeaningfulChars: 1,
      });
    }

    const refs = await this.resolveRefs();
    const supportName = input.contributorName?.trim() || null;
    const sessionId = generateId();
    const writeActorId = ANONIM_USER_ID;

    await this.sessionRepo.upsert({
      id: sessionId,
      triggeredBy: input.triggeredBy,
      attributedTo: ANONIM_USER_ID,
      sourceLabel: BATCH_CONTRIBUTE_SOURCE_LABEL,
      supportName,
      supportType: 'other',
      status: 'running',
      total: input.rows.length,
      createdCount: 0,
      duplicatesCount: 0,
      meaningsAddedCount: 0,
      invalidCount: 0,
      items: [],
      finishedAt: null,
    });

    const items: ImportWordResult[] = [];
    let createdCount = 0;
    let duplicatesCount = 0;
    let meaningsAddedCount = 0;
    let invalidCount = 0;

    try {
      for (const row of input.rows) {
        const result = await this.one(row, writeActorId, refs, sessionId);
        items.push(result);
        if (result.outcome === 'created') createdCount += 1;
        else if (result.outcome === 'skipped') duplicatesCount += 1;
        else if (result.outcome === 'meanings_added') {
          meaningsAddedCount += 1;
        } else invalidCount += 1;
      }

      const sessionItems: WordImportSessionItem[] = items.map((item) => ({
        lemma: item.lemma,
        outcome: item.outcome,
        meanings_added: item.meanings_added,
        message: item.message,
        ...(item.word_id ? { word_id: item.word_id } : {}),
      }));

      await this.sessionRepo.upsert({
        id: sessionId,
        triggeredBy: input.triggeredBy,
        attributedTo: ANONIM_USER_ID,
        sourceLabel: BATCH_CONTRIBUTE_SOURCE_LABEL,
        supportName,
        supportType: 'other',
        status: 'completed',
        total: input.rows.length,
        createdCount,
        duplicatesCount,
        meaningsAddedCount,
        invalidCount,
        items: sessionItems,
        finishedAt: new Date(),
      });
    } catch (err) {
      await this.sessionRepo.upsert({
        id: sessionId,
        triggeredBy: input.triggeredBy,
        attributedTo: ANONIM_USER_ID,
        sourceLabel: BATCH_CONTRIBUTE_SOURCE_LABEL,
        supportName,
        supportType: 'other',
        status: 'failed',
        total: input.rows.length,
        createdCount,
        duplicatesCount,
        meaningsAddedCount,
        invalidCount,
        items: items.map((item) => ({
          lemma: item.lemma,
          outcome: item.outcome,
          meanings_added: item.meanings_added,
          message: item.message,
          ...(item.word_id ? { word_id: item.word_id } : {}),
        })),
        finishedAt: new Date(),
      });
      throw err;
    }

    return {
      session_id: sessionId,
      total: input.rows.length,
      created_count: createdCount,
      duplicates_count: duplicatesCount,
      meanings_added_count: meaningsAddedCount,
      invalid_count: invalidCount,
      items,
    };
  }

  private async resolveRefs() {
    const languages = await this.languageRepo.listLanguages(false);
    const sambas = languages.find((l) => l.code.toUpperCase() === 'SBS');
    const indonesia = languages.find((l) => l.code.toUpperCase() === 'IDN');
    if (!sambas || !indonesia) {
      throw new BadRequestError('BATCH_REFS', 'Bahasa Sambas atau Indonesia belum tersedia');
    }
    const dialects = await this.languageRepo.listDialects(sambas.id, false);
    const dialect =
      dialects.find((d) => d.isDefault) ??
      dialects.find((d) => d.code.trim().toLowerCase() === 'umum');
    const classes = await this.wordRepo.listWordClasses();
    const umum = classes.find((c) => c.code.trim().toLowerCase() === 'umum');
    if (!umum) {
      throw new BadRequestError('BATCH_REFS', 'Kelas kata umum belum tersedia');
    }
    return {
      languageId: sambas.id,
      translationLanguageId: indonesia.id,
      dialectId: dialect?.id,
      wordClassId: umum.id,
    };
  }

  private async one(
    row: BatchContributeRow,
    writeActorId: string,
    refs: {
      languageId: string;
      translationLanguageId: string;
      dialectId?: string;
      wordClassId: string;
    },
    sessionId: string,
  ): Promise<ImportWordResult> {
    const lemma = row.sambas.trim();
    const meaning = preparedMeaning({
      translation: row.indonesia,
      definition: '',
    });
    if (!lemma || !meaning) {
      return {
        lemma,
        outcome: 'invalid',
        meanings_added: 0,
        meanings_skipped: 0,
        message: 'Kata Sambas dan padanan Indonesia wajib diisi',
      };
    }

    const parent = await this.wordRepo.findActiveByLemma(refs.languageId, lemma);
    // Massal web: selalu tayang (bukan antrean review).
    const status = 'published' as const;
    const isVerified = false;

    if (!parent) {
      const word = await this.wordRepo.saveWithRelations(
        {
          languageId: refs.languageId,
          dialectId: refs.dialectId,
          lemma,
          wordType: 'word',
          meanings: [
            {
              wordClassId: refs.wordClassId,
              definition: meaning.definition,
              isHaveDefinition: meaning.isHaveDefinition,
              isHaveTranslation: meaning.isHaveTranslation,
              orderIndex: 1,
              translations: meaning.isHaveTranslation
                ? [
                    {
                      languageId: refs.translationLanguageId,
                      translationText: meaning.translation,
                      translationType: 'direct',
                    },
                  ]
                : [],
              examples: [],
            },
          ],
          categoryIds: [],
          relatedWords: [],
          usageLabels: [],
          status,
          isVerified,
          importSessionId: sessionId,
        },
        writeActorId,
      );
      return {
        lemma: word.lemma,
        outcome: 'created',
        status,
        is_verified: false,
        meanings_added: 1,
        meanings_skipped: 0,
        word_id: word.id,
      };
    }

    const existing = new Set(
      (await this.wordRepo.listMeaningKeys(parent.id)).map((m) =>
        meaningFingerprint({
          definition: m.isHaveDefinition ? m.definition : '',
          translation: m.translation,
          isHaveDefinition: m.isHaveDefinition,
          isHaveTranslation: m.isHaveTranslation,
        }),
      ),
    );
    if (existing.has(meaningFingerprint(meaning))) {
      return {
        lemma,
        outcome: 'skipped',
        meanings_added: 0,
        meanings_skipped: 1,
        message: 'Duplikat: makna ini sudah ada pada kata tersebut',
        word_id: parent.id,
      };
    }

    // Lemma sudah ada: tambah makna. Rollback sesi TIDAK menghapus makna ini
    // (hanya kata dengan import_session_id = sesi).
    await this.wordRepo.addMeaning(
      parent.id,
      {
        wordClassId: refs.wordClassId,
        definition: meaning.definition,
        isHaveDefinition: meaning.isHaveDefinition,
        isHaveTranslation: meaning.isHaveTranslation,
        translations: meaning.isHaveTranslation
          ? [
              {
                languageId: refs.translationLanguageId,
                translationText: meaning.translation,
                translationType: 'direct',
              },
            ]
          : [],
        status,
        isVerified,
      },
      writeActorId,
    );
    return {
      lemma,
      outcome: 'meanings_added',
      status,
      is_verified: false,
      meanings_added: 1,
      meanings_skipped: 0,
      message:
        'Makna ditambahkan ke kata yang sudah ada (rollback sesi tidak menarik makna ini)',
      word_id: parent.id,
    };
  }
}
