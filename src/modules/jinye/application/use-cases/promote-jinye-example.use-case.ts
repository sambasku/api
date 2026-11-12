import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { resolveChildPublication } from '@/modules/word/application/utils/resolve-publication';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { JinyePromoteExampleResult } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

/**
 * Owner usul body (± audio) Jinye jadi contoh kalimat lemma (pending/published per role).
 * Attribution: examples.source_type=jinye + source_reference=jinyeId.
 */
export class PromoteJinyeExampleUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly words: Pick<
      WordRepository,
      | 'findById'
      | 'findMeaningById'
      | 'findFirstMeaningId'
      | 'findLanguageIdByCode'
      | 'addExample'
      | 'addWordAudio'
    >,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    role: string;
    wordId: string;
    meaningId?: string | null;
    includeAudio?: boolean;
    targetSentence?: string | null;
    requestId?: string | null;
  }): Promise<JinyePromoteExampleResult> {
    await assertCanContribute(input.userId);

    const jinye = await this.repo.findById(input.jinyeId);
    if (!jinye || jinye.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (jinye.userId !== input.userId) {
      throw new ForbiddenError(
        'NOT_OWNER',
        'Hanya penulis yang bisa mengajukan Jinye ini jadi contoh lemma',
      );
    }

    const body = jinye.body.trim();
    const wantAudio = input.includeAudio === true;
    if (!body && !(wantAudio && jinye.audio)) {
      throw new ValidationError([
        {
          field: 'body',
          message: 'Jinye perlu teks atau rekaman untuk dijadikan contoh.',
        },
      ]);
    }
    if (wantAudio && !jinye.audio) {
      throw new ValidationError([
        {
          field: 'include_audio',
          message: 'Jinye ini belum punya rekaman suara.',
        },
      ]);
    }

    const word = await this.words.findById(input.wordId);
    if (
      !word ||
      word.status !== 'published' ||
      !word.isVerified ||
      word.deletedAt
    ) {
      throw new ValidationError([
        {
          field: 'word_id',
          message: 'Pilih kata yang sudah tayang dan terverifikasi ya.',
        },
      ]);
    }

    let meaningId = input.meaningId?.trim() || null;
    if (meaningId) {
      const meaning = await this.words.findMeaningById(meaningId);
      if (!meaning || meaning.wordId !== word.id) {
        throw new ValidationError([
          {
            field: 'meaning_id',
            message: 'Makna tidak cocok dengan kata yang dipilih.',
          },
        ]);
      }
    } else {
      meaningId = await this.words.findFirstMeaningId(word.id);
      if (!meaningId) {
        throw new ValidationError([
          {
            field: 'word_id',
            message: 'Kata ini belum punya makna. Lengkapi dulu ya.',
          },
        ]);
      }
    }

    const sourceLanguageId = word.languageId;
    let targetLanguageId: string | null = null;
    const targetSentence = input.targetSentence?.trim() || null;
    if (targetSentence) {
      targetLanguageId = await this.words.findLanguageIdByCode('id');
      if (!targetLanguageId) {
        throw new ValidationError([
          {
            field: 'target_sentence',
            message: 'Bahasa Indonesia belum tersedia di sistem.',
          },
        ]);
      }
    }

    const publication = resolveChildPublication(input.role);
    const sourceSentence =
      body.length > 0
        ? body
        : '(Rekaman suara dari Jinye)';

    const example = await this.words.addExample(
      meaningId,
      {
        sourceLanguageId,
        sourceSentence,
        targetLanguageId,
        targetSentence,
        sourceType: 'jinye',
        sourceReference: jinye.id,
        notes: `Dipromosikan dari Jinye ${jinye.id}`,
        status: publication.status,
        isVerified: publication.isVerified,
      },
      input.userId,
    );

    let wordAudioId: string | null = null;
    if (wantAudio && jinye.audio) {
      try {
        const audio = await this.words.addWordAudio(
          word.id,
          {
            exampleId: example.id,
            provider: jinye.audio.provider,
            // Unique (provider, provider_file_id): alias, URL sama dengan Jinye.
            providerFileId: `jinye-promote/${jinye.id}/${example.id}`,
            sha: jinye.audio.sha,
            url: jinye.audio.url,
            mimeType: jinye.audio.mimeType,
            fileSize: jinye.audio.fileSize,
            durationMs: jinye.audio.durationMs,
            speakerConsent: true,
            isPrimary: false,
            status: publication.status,
            isVerified: publication.isVerified,
          },
          input.userId,
        );
        wordAudioId = audio.id;
      } catch {
        throw new ConflictError(
          'JINYE_PROMOTE_AUDIO_FAILED',
          'Contoh tersimpan, tapi audio gagal dilampirkan. Coba lagi tanpa audio atau hubungi admin.',
        );
      }
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'example',
      entityId: example.id,
      newData: {
        source: 'jinye',
        jinye_id: jinye.id,
        word_id: word.id,
        meaning_id: meaningId,
        word_audio_id: wordAudioId,
        status: example.status,
      },
      requestId: input.requestId ?? null,
    });

    return {
      exampleId: example.id,
      wordAudioId,
      status: example.status,
      isVerified: example.isVerified,
    };
  }
}
