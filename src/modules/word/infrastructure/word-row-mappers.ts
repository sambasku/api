import { words, pronunciations, wordImages, wordAudios, examples } from '@/shared/database/drizzle/schema';
import type { UsageLabel } from '@/shared/constants/usage-labels';
import { USAGE_LABEL_SET } from '@/shared/constants/usage-labels';
import type { ImageContentWarning } from '@/shared/constants/image-content-warnings';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import type { ChildStatus, Word, WordStatus } from '../domain/entities/word.entity';
import type {
  ExampleMedia,
  PronunciationMedia,
  WordAudioMedia,
  WordImageMedia,
} from '../domain/repositories/word.repository';

export function toUsageLabels(raw: unknown): UsageLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is UsageLabel => typeof x === 'string' && USAGE_LABEL_SET.has(x));
}

export function toContentWarnings(raw: unknown): ImageContentWarning[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ImageContentWarning =>
      typeof x === 'string' && IMAGE_CONTENT_WARNING_SET.has(x),
  );
}

export function toWord(row: typeof words.$inferSelect): Word {
  return {
    id: row.id,
    languageId: row.languageId,
    lemma: row.lemma,
    lemmaAllowsComma: row.lemmaAllowsComma ?? false,
    notes: row.notes,
    wordType: row.wordType as Word['wordType'],
    usageLabels: toUsageLabels(row.usageLabels),
    status: row.status as WordStatus,
    isVerified: row.isVerified,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt,
    isCorrected: row.isCorrected,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deletedBy: row.deletedBy,
    takedownReasonCode: row.takedownReasonCode,
    takedownNote: row.takedownNote,
    takenDownBy: row.takenDownBy,
    takenDownAt: row.takenDownAt,
    importSessionId: row.importSessionId ?? null,
  };
}

export function toPronunciation(row: typeof pronunciations.$inferSelect): PronunciationMedia {
  return {
    id: row.id,
    wordId: row.wordId,
    dialectId: row.dialectId,
    notation: row.notation,
    value: row.value,
    audioUrl: row.audioUrl,
    speakerName: row.speakerName,
    notes: row.notes,
    status: row.status as ChildStatus,
    isVerified: row.isVerified,
    isCorrected: row.isCorrected,
  };
}

export function toWordImage(row: typeof wordImages.$inferSelect): WordImageMedia {
  return {
    id: row.id,
    wordId: row.wordId,
    provider: row.provider,
    providerFileId: row.providerFileId,
    sha: row.sha ?? null,
    url: row.url,
    altText: row.altText,
    isPrimary: row.isPrimary,
    contentWarnings: toContentWarnings(row.contentWarnings),
    status: row.status as ChildStatus,
    isVerified: row.isVerified,
    isCorrected: row.isCorrected,
    sourceType: row.sourceType ?? null,
    sourceReference: row.sourceReference ?? null,
  };
}

export function toWordAudio(row: typeof wordAudios.$inferSelect): WordAudioMedia {
  return {
    id: row.id,
    wordId: row.wordId,
    exampleId: row.exampleId,
    dialectId: row.dialectId,
    provider: row.provider,
    providerFileId: row.providerFileId,
    sha: row.sha,
    url: row.url,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    durationMs: row.durationMs,
    speakerName: row.speakerName,
    speakerConsent: row.speakerConsent,
    isPrimary: row.isPrimary,
    status: row.status as ChildStatus,
    isVerified: row.isVerified,
    isCorrected: row.isCorrected,
  };
}

export function toExample(row: typeof examples.$inferSelect): ExampleMedia {
  return {
    id: row.id,
    meaningId: row.meaningId,
    sourceLanguageId: row.sourceLanguageId,
    sourceSentence: row.sourceSentence,
    targetLanguageId: row.targetLanguageId,
    targetSentence: row.targetSentence,
    sourceType: row.sourceType,
    notes: row.notes,
    status: row.status as ChildStatus,
    isVerified: row.isVerified,
    isCorrected: row.isCorrected,
  };
}
