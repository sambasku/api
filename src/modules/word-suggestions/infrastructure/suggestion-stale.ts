/** Shared helpers for word-suggestion repository. */
import { captureBaseline } from './suggestion-baseline';
import { eq, and, isNull, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { words, meanings, meaningTranslations, examples, pronunciations, lexicalRelations, wordVariants, wordImages, wordGroupMembers } from '@/shared/database/drizzle/schema';
import type { ProposedChanges } from '../domain/entities/word-suggestion.entity';
import { BadRequestError, ConflictError } from '@/shared/errors/app-error';
export const STALE_MESSAGE = 'Data kata sudah berubah. Muat ulang lalu coba lagi.';

/**
 * ID makna/foto/relasi/variasi yang diubah atau dihapus harus masih milik
 * kata ini. Tanpa ini ID basi dilewati diam-diam saat apply (nol perubahan).
 * Ubah makna yang isinya sama persis dengan data sekarang juga ditolak.
 */
export async function assertProposedTargetsCurrent(wordId: string, c: ProposedChanges): Promise<void> {
  const stale = () => new ConflictError('SUGGESTION_STALE_DATA', STALE_MESSAGE);

  const meaningIds = [
    ...new Set((c.meanings ?? []).filter((m) => m.meaningId).map((m) => m.meaningId!)),
  ];
  if (meaningIds.length > 0) {
    const rows = await db
      .select({ id: meanings.id, definition: meanings.definition, wordClassId: meanings.wordClassId })
      .from(meanings)
      .where(
        and(inArray(meanings.id, meaningIds), eq(meanings.wordId, wordId), isNull(meanings.deletedAt)),
      );
    if (rows.length !== meaningIds.length) throw stale();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const translations = await db
      .select({
        meaningId: meaningTranslations.meaningId,
        languageId: meaningTranslations.languageId,
        translationText: meaningTranslations.translationText,
      })
      .from(meaningTranslations)
      .where(
        and(inArray(meaningTranslations.meaningId, meaningIds), isNull(meaningTranslations.deletedAt)),
      );
    for (const mc of c.meanings ?? []) {
      if (mc.action !== 'update' || !mc.meaningId) continue;
      const cur = byId.get(mc.meaningId)!;
      const changed =
        (mc.definition !== undefined && mc.definition.trim() !== (cur.definition ?? '').trim()) ||
        (mc.wordClassId !== undefined && mc.wordClassId !== cur.wordClassId) ||
        (mc.translations ?? []).some(
          (t) =>
            !translations.some(
              (x) =>
                x.meaningId === mc.meaningId &&
                x.languageId === t.languageId &&
                x.translationText.trim() === t.translationText.trim(),
            ),
        );
      if (!changed) {
        throw new BadRequestError('SUGGESTION_NO_CHANGES', 'Tidak ada yang berubah dari data sekarang', [
          { field: 'meanings', message: 'Isi masih sama dengan data sekarang' },
        ]);
      }
    }
  }

  const exampleIds = [
    ...new Set((c.examples ?? []).filter((ex) => ex.exampleId).map((ex) => ex.exampleId)),
  ];
  if (exampleIds.length > 0) {
    const rows = await db
      .select({
        id: examples.id,
        sourceSentence: examples.sourceSentence,
        targetSentence: examples.targetSentence,
        status: examples.status,
      })
      .from(examples)
      .innerJoin(meanings, eq(examples.meaningId, meanings.id))
      .where(
        and(
          inArray(examples.id, exampleIds),
          eq(meanings.wordId, wordId),
          isNull(examples.deletedAt),
          isNull(meanings.deletedAt),
        ),
      );
    if (rows.length !== exampleIds.length) throw stale();
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const ec of c.examples ?? []) {
      const cur = byId.get(ec.exampleId);
      if (!cur) throw stale();
        // Hanya contoh yang sudah tayang bisa diusulkan ubah (pending = jalur review kontribusi).
        if (cur.status !== 'published') throw stale();
        // action=delete tidak butuh isi baru; existence + published check di atas sudah cukup.
        const changed =
          ec.action === 'delete' ||
          (ec.sourceSentence !== undefined &&
            ec.sourceSentence.trim() !== (cur.sourceSentence ?? '').trim()) ||
          (ec.targetSentence !== undefined &&
            (ec.targetSentence ?? '').trim() !== (cur.targetSentence ?? '').trim());
      if (!changed) {
        throw new BadRequestError('SUGGESTION_NO_CHANGES', 'Tidak ada yang berubah dari data sekarang', [
          { field: 'examples', message: 'Isi masih sama dengan data sekarang' },
        ]);
      }
    }
  }

  const pronunciationIds = [
    ...new Set(
      (c.pronunciations ?? []).filter((p) => p.pronunciationId).map((p) => p.pronunciationId),
    ),
  ];
  if (pronunciationIds.length > 0) {
    const rows = await db
      .select({
        id: pronunciations.id,
        value: pronunciations.value,
        status: pronunciations.status,
      })
      .from(pronunciations)
      .where(
        and(
          inArray(pronunciations.id, pronunciationIds),
          eq(pronunciations.wordId, wordId),
          isNull(pronunciations.deletedAt),
        ),
      );
    if (rows.length !== pronunciationIds.length) throw stale();
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const pc of c.pronunciations ?? []) {
      const cur = byId.get(pc.pronunciationId);
      if (!cur) throw stale();
      if (cur.status !== 'published') throw stale();
      // Samakan dengan strip slash tepi di validator (data lama bisa `/ipa/`).
      const next = pc.value.trim().replace(/^\/+|\/+$/g, '').trim();
      const curRaw = (cur.value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
      if (next === curRaw) {
        throw new BadRequestError('SUGGESTION_NO_CHANGES', 'Tidak ada yang berubah dari data sekarang', [
          { field: 'pronunciations', message: 'Isi masih sama dengan data sekarang' },
        ]);
      }
    }
  }

  const imageIds = [
    ...new Set(
      (c.images ?? [])
        .filter((i) => (i.action === 'remove' || i.action === 'set_primary') && i.imageId)
        .map((i) => i.imageId!),
    ),
  ];
  if (imageIds.length > 0) {
    const rows = await db
      .select({ id: wordImages.id })
      .from(wordImages)
      .where(
        and(inArray(wordImages.id, imageIds), eq(wordImages.wordId, wordId), isNull(wordImages.deletedAt)),
      );
    if (rows.length !== imageIds.length) throw stale();
  }

  for (const rel of c.relations ?? []) {
    if (rel.action !== 'remove' || !rel.wordId) continue;
    const [row] = await db
      .select({ id: lexicalRelations.id })
      .from(lexicalRelations)
      .where(
        and(
          eq(lexicalRelations.sourceWordId, wordId),
          eq(lexicalRelations.targetWordId, rel.wordId),
          eq(lexicalRelations.relationType, rel.relationType),
          isNull(lexicalRelations.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw stale();
  }

  for (const v of c.variants ?? []) {
    if (v.action !== 'remove') continue;
    const [row] = await db
      .select({ id: wordVariants.id })
      .from(wordVariants)
      .where(
        and(
          eq(wordVariants.wordId, wordId),
          eq(wordVariants.form, v.form.trim()),
          isNull(wordVariants.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw stale();
  }

  // PRD relasi-lemma: keluar kelompok hanya sah bila masih anggota.
  for (const g of c.groups ?? []) {
    if (g.action !== 'remove' || !g.groupId) continue;
    const [row] = await db
      .select({ id: wordGroupMembers.id })
      .from(wordGroupMembers)
      .where(
        and(
          eq(wordGroupMembers.groupId, g.groupId),
          eq(wordGroupMembers.wordId, wordId),
          isNull(wordGroupMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw stale();
  }
}
/**
 * Kembalikan hanya field yang disentuh usulan ini. Usulan lain (kategori
 * berbeda) bisa tayang bersamaan di kata yang sama. `is_verified` tidak
 * disentuh: apply_pending tidak mengubahnya, dan menimpanya balik bisa
 * mencabut verifikasi dari usulan lain yang sudah disetujui.
 */
export async function restoreBaseline(
  wordId: string,
  raw: unknown,
  proposed: ProposedChanges,
): Promise<void> {
  const snap = raw as Awaited<ReturnType<typeof captureBaseline>> | null;
  if (!snap || typeof snap !== 'object' || !snap.lemma) return;

  const wordPatch: { lemma?: string; notes?: string | null; wordType?: string } = {};
  if (proposed.lemma !== undefined) wordPatch.lemma = snap.lemma;
  if (proposed.notes !== undefined) wordPatch.notes = snap.notes;
  // Snapshot lama belum menyimpan jenis entri: lewati.
  if (proposed.wordType !== undefined && typeof snap.wordType === 'string') {
    wordPatch.wordType = snap.wordType;
  }
  if (Object.keys(wordPatch).length > 0) {
    await db
      .update(words)
      .set({ ...wordPatch, updatedAt: new Date() })
      .where(eq(words.id, wordId));
  }

  const snapById = new Map((snap.meanings ?? []).map((m) => [m.id, m]));
  for (const mc of proposed.meanings ?? []) {
    if (mc.action !== 'update' || !mc.meaningId) continue;
    const meaning = snapById.get(mc.meaningId);
    if (!meaning) continue;

    const patch: { definition?: string; wordClassId?: string | null } = {};
    if (mc.definition !== undefined) patch.definition = meaning.definition;
    // Snapshot lama belum menyimpan kelas kata: lewati.
    if (mc.wordClassId !== undefined && meaning.wordClassId !== undefined) {
      patch.wordClassId = meaning.wordClassId;
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(meanings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(meanings.id, meaning.id));
    }

    if (!mc.translations?.length) continue;
    const keepIds = meaning.translations.map((t) => t.id);
    for (const translation of meaning.translations) {
      await db
        .update(meaningTranslations)
        .set({ translationText: translation.translationText, updatedAt: new Date() })
        .where(eq(meaningTranslations.id, translation.id));
    }
    // Padanan yang baru ditambahkan usulan ini (tidak ada di snapshot).
    await db
      .update(meaningTranslations)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(meaningTranslations.meaningId, meaning.id),
          isNull(meaningTranslations.deletedAt),
          keepIds.length > 0 ? notInArray(meaningTranslations.id, keepIds) : undefined,
        ),
      );
  }

  const snapExById = new Map((snap.examples ?? []).map((ex) => [ex.id, ex]));
  for (const ec of proposed.examples ?? []) {
    if (ec.action !== 'update' || !ec.exampleId) continue;
    const ex = snapExById.get(ec.exampleId);
    if (!ex) continue;
    const patch: { sourceSentence?: string; targetSentence?: string | null } = {};
    if (ec.sourceSentence !== undefined) patch.sourceSentence = ex.sourceSentence;
    if (ec.targetSentence !== undefined) patch.targetSentence = ex.targetSentence;
    if (Object.keys(patch).length === 0) continue;
    await db
      .update(examples)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(examples.id, ex.id));
  }

  const snapPronById = new Map((snap.pronunciations ?? []).map((p) => [p.id, p]));
  for (const pc of proposed.pronunciations ?? []) {
    if (pc.action !== 'update' || !pc.pronunciationId) continue;
    const p = snapPronById.get(pc.pronunciationId);
    if (!p) continue;
    await db
      .update(pronunciations)
      .set({ value: p.value, updatedAt: new Date() })
      .where(eq(pronunciations.id, p.id));
  }
}

