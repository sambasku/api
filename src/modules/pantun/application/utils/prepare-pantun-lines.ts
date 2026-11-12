import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { RecordAbuseSignalUseCase } from '@/shared/moderation/record-abuse-signal.use-case';
import { assertUgcTextQualityWithStrike } from '@/shared/moderation/assert-ugc-text-quality-with-strike';
import { ValidationError } from '@/shared/errors/app-error';
import { type RhymeScheme } from './rhyme-check';
import { resolveRhymeScheme } from './resolve-rhyme';

/**
 * Validasi struktur + rima + UGC quality + blocklist untuk pantun/balasan teks.
 * Dipakai create teks dan create+audio (bila teks ikut dikirim).
 */
export async function preparePantunLines(input: {
  lines: string[];
  rhymeScheme?: RhymeScheme | null;
  userId: string;
  entityType: 'pantun' | 'pantun_reply';
  requestId?: string | null;
  blocklistRepo: CommentBlocklistRepository;
  abuse?: RecordAbuseSignalUseCase;
}): Promise<{ cleaned: string[]; scheme: RhymeScheme }> {
  if (input.lines.length !== 4) {
    throw new ValidationError([
      { field: 'lines', message: 'Pantun harus terdiri dari 4 baris' },
    ]);
  }
  const cleaned = input.lines.map((l) => l.trim().replace(/\s+/g, ' '));
  if (cleaned.some((l) => l.length === 0)) {
    throw new ValidationError([
      {
        field: 'lines',
        message: 'Ada baris kosong. Lengkapi keempat barisnya ya.',
      },
    ]);
  }
  const joined = cleaned.join('\n');
  if (joined.length > 600) {
    throw new ValidationError([
      { field: 'lines', message: 'Total isi pantun maksimal 600 karakter' },
    ]);
  }
  const scheme = resolveRhymeScheme(cleaned, input.rhymeScheme);
  void (await assertUgcTextQualityWithStrike(joined, {
    userId: input.userId,
    abuse: input.abuse,
    entityType: input.entityType,
    requestId: input.requestId,
  }));

  const activeWords = await input.blocklistRepo.listAllActiveWords();
  const lowerLines = cleaned.map((l) => l.toLowerCase());
  for (const w of activeWords) {
    const word = w.toLowerCase();
    if (lowerLines.some((l) => l.includes(word))) {
      throw new ValidationError([
        {
          field: 'lines',
          message: 'Isi pantun mengandung kata yang tidak boleh dipakai',
        },
      ]);
    }
  }

  return { cleaned, scheme };
}

/**
 * Untuk endpoint audio: teks opsional.
 * - tanpa baris / semua kosong → voice-only (`[]`, scheme placeholder ABAB)
 * - 4 baris terisi → validasi penuh seperti pantun teks
 */
export async function prepareOptionalPantunLines(input: {
  lines: string[] | null | undefined;
  rhymeScheme?: RhymeScheme | null;
  userId: string;
  entityType: 'pantun' | 'pantun_reply';
  requestId?: string | null;
  blocklistRepo: CommentBlocklistRepository;
  abuse?: RecordAbuseSignalUseCase;
}): Promise<{ cleaned: string[]; scheme: RhymeScheme; voiceOnly: boolean }> {
  const raw = (input.lines ?? []).map((l) => l.trim());
  const anyText = raw.some((l) => l.length > 0);
  if (!anyText) {
    // Placeholder scheme: DB NOT NULL; wire mengabaikan bila lines kosong.
    return { cleaned: [], scheme: 'ABAB', voiceOnly: true };
  }
  const prepared = await preparePantunLines({
    ...input,
    lines: raw,
  });
  return { ...prepared, voiceOnly: false };
}
