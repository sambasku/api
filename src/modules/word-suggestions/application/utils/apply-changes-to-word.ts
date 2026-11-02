import type { ProposedChanges } from '../../domain/entities/word-suggestion.entity';
import { NotFoundError, ConflictError, BadRequestError } from '@/shared/errors/app-error';
import { resolveWordImageProvider } from '@/modules/word/domain/word-image-provider';
import { db } from '@/shared/database/drizzle/client';
import {
  wordEditSuggestions,
  words,
  meanings,
  meaningTranslations,
  wordCategories,
  auditLogs,
  lexicalRelations,
  wordVariants,
  wordImages,
  wordGroups,
  wordGroupMembers,
} from '@/shared/database/drizzle/schema';
import { contributions } from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import {
  loadMeaningFingerprints,
  meaningDeduplicationFingerprint,
} from '@/modules/word/application/utils/meaning-deduplication';

/** Foto utama terhapus tanpa pengganti: foto tersisa paling lama jadi utama. */
async function ensurePrimaryImage(wordId: string): Promise<void> {
  const active = and(eq(wordImages.wordId, wordId), isNull(wordImages.deletedAt));
  const primary = await db.query.wordImages.findFirst({
    where: and(active, eq(wordImages.isPrimary, true)),
    columns: { id: true },
  });
  if (primary) return;
  const oldest = await db.query.wordImages.findFirst({
    where: active,
    orderBy: (w, { asc }) => [asc(w.createdAt)],
    columns: { id: true },
  });
  if (!oldest) return;
  await db.update(wordImages).set({ isPrimary: true }).where(eq(wordImages.id, oldest.id));
}

/** Jenis `word` tidak boleh tetap punya relasi komponen frasa. */
export async function assertWordTypeAllowsComponents(
  wordId: string,
  wordType: string | undefined,
): Promise<void> {
  if (wordType !== 'word') return;
  const [row] = await db
    .select({ id: lexicalRelations.id })
    .from(lexicalRelations)
    .where(
      and(
        eq(lexicalRelations.sourceWordId, wordId),
        eq(lexicalRelations.relationType, 'has_component'),
        isNull(lexicalRelations.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return;
  throw new BadRequestError(
    'VALIDATION_ERROR',
    'has_component hanya untuk entri idiom/peribahasa/ungkapan',
    [{ field: 'word_type', message: 'has_component hanya untuk entri idiom/peribahasa/ungkapan' }],
  );
}

export interface ApplyResult {
  applied: boolean;
  changesApplied: number;
  wordLemma: string;
  wordId: string;
  /** Kata baru yang dibuat saat approve (lemma target belum ada di kamus). */
  createdWords: { id: string; lemma: string }[];
}

/**
 * PRD relasi-lemma: resolve lemma target → id kata. Sudah ada (case-
 * insensitive, sama bahasa) → pakai; belum ada → buat kata baru published +
 * terverifikasi (approve = verifikator mengesahkan), makna diwarisi dari
 * kata sumber. Re-check di sini = jaring race dua approve bersamaan: entri
 * yang menang dipakai, tidak ada duplikat.
 */
async function resolveOrCreateTarget(
  source: { id: string; languageId: string; lemma: string },
  lemma: string,
  actorId: string,
  reviewerId: string,
): Promise<{ id: string; lemma: string; created: boolean }> {
  const trimmed = lemma.trim();
  const [existing] = await db
    .select({ id: words.id, lemma: words.lemma })
    .from(words)
    .where(
      and(
        eq(words.languageId, source.languageId),
        sql`lower(${words.lemma}) = lower(${trimmed})`,
        isNull(words.deletedAt),
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id, lemma: existing.lemma, created: false };
  if (trimmed.toLowerCase() === source.lemma.trim().toLowerCase()) {
    return { id: source.id, lemma: source.lemma, created: false };
  }

  // Makna sumber (published) untuk diwarisi - provenance inheritedFrom.
  const sourceMeanings = await db.query.meanings.findMany({
    where: and(
      eq(meanings.wordId, source.id),
      isNull(meanings.deletedAt),
      eq(meanings.status, 'published'),
    ),
    orderBy: (m, { asc }) => [asc(m.orderIndex)],
  });
  const [newRow] = await db
    .insert(words)
    .values({
      languageId: source.languageId,
      lemma: trimmed,
      wordType: 'word',
      status: 'published',
      isVerified: true,
      verifiedBy: reviewerId,
      verifiedAt: new Date(),
      createdBy: actorId,
      updatedBy: reviewerId,
    })
    .returning({ id: words.id });

  if (sourceMeanings.length > 0) {
    const srcIds = sourceMeanings.map((m) => m.id);
    const srcTranslations = await db
      .select({
        meaningId: meaningTranslations.meaningId,
        languageId: meaningTranslations.languageId,
        translationText: meaningTranslations.translationText,
        translationType: meaningTranslations.translationType,
      })
      .from(meaningTranslations)
      .where(
        and(
          inArray(meaningTranslations.meaningId, srcIds),
          isNull(meaningTranslations.deletedAt),
        ),
      );
    const newMeaningIds = sourceMeanings.map(() => generateId());
    await db.insert(meanings).values(
      sourceMeanings.map((m, i) => ({
        id: newMeaningIds[i],
        wordId: newRow.id,
        wordClassId: m.wordClassId,
        inheritedFromMeaningId: m.id,
        definition: m.definition,
        isHaveDefinition: m.isHaveDefinition,
        isHaveTranslation: m.isHaveTranslation,
        meaningSource: m.meaningSource,
        orderIndex: m.orderIndex,
        status: 'published',
        isVerified: true,
        createdBy: actorId,
      })),
    );
    const translationValues = srcTranslations.flatMap((t) => {
      const idx = srcIds.indexOf(t.meaningId);
      if (idx < 0) return [];
      return [
        {
          meaningId: newMeaningIds[idx],
          languageId: t.languageId,
          translationText: t.translationText,
          translationType: t.translationType,
          createdBy: actorId,
        },
      ];
    });
    if (translationValues.length > 0) {
      await db.insert(meaningTranslations).values(translationValues);
    }
  }

  await db.insert(contributions).values({
    userId: actorId,
    entityType: 'word',
    entityId: newRow.id,
    action: 'create',
    status: 'approved',
  });

  return { id: newRow.id, lemma: trimmed, created: true };
}

/**
 * Terapkan proposed_changes ke kata. Dipakai oleh approveSuggestion dan
 * correctSuggestion (publish=true).
 */
export async function applyChangesToWord(
  suggestionId: string,
  reviewerId: string,
  action: 'approve' | 'correct_and_publish' | 'apply_pending',
  comment?: string,
  customChanges?: ProposedChanges,
): Promise<ApplyResult> {
  const suggestion = await db.query.wordEditSuggestions.findFirst({
    where: and(eq(wordEditSuggestions.id, suggestionId), isNull(wordEditSuggestions.deletedAt)),
    columns: { id: true, wordId: true, userId: true, proposedChanges: true, status: true },
  });

  if (!suggestion) throw new NotFoundError('SUGGESTION_NOT_FOUND', 'Usulan tidak ditemukan');
  if (suggestion.status !== 'pending') {
    throw new ConflictError('SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah pernah diverifikasi');
  }

  const changes = customChanges ?? (suggestion.proposedChanges as ProposedChanges);
  let changesApplied = 0;
  const createdWords: { id: string; lemma: string }[] = [];

  const word = await db.query.words.findFirst({
    where: and(eq(words.id, suggestion.wordId), isNull(words.deletedAt)),
    columns: { id: true, lemma: true, notes: true, wordType: true, isVerified: true, languageId: true },
  });

  if (!word) throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');

  await assertWordTypeAllowsComponents(word.id, changes.wordType);

  const oldAudit: Record<string, unknown> = {
    lemma: word.lemma,
    notes: word.notes,
    word_type: word.wordType,
  };
  const newAudit: Record<string, unknown> = {
    lemma: changes.lemma ?? word.lemma,
    notes: changes.notes ?? word.notes,
    word_type: changes.wordType ?? word.wordType,
  };

  if (changes.lemma !== undefined && changes.lemma !== word.lemma) {
    await db
      .update(words)
      .set({ lemma: changes.lemma, updatedAt: new Date() })
      .where(eq(words.id, word.id));
    changesApplied++;
  }

  if (changes.notes !== undefined && changes.notes !== word.notes) {
    await db
      .update(words)
      .set({ notes: changes.notes, updatedAt: new Date() })
      .where(eq(words.id, word.id));
    changesApplied++;
  }

  if (changes.wordType !== undefined && changes.wordType !== word.wordType) {
    await db
      .update(words)
      .set({ wordType: changes.wordType, updatedAt: new Date() })
      .where(eq(words.id, word.id));
    changesApplied++;
  }

  if (changes.meanings && changes.meanings.length > 0) {
    const existingMeanings = await db.query.meanings.findMany({
      where: and(eq(meanings.wordId, word.id), isNull(meanings.deletedAt)),
      orderBy: (m, { asc }) => [asc(m.orderIndex)],
    });
    const existingMap = new Map(existingMeanings.map((m) => [m.id, m]));
    // #174: usulan "tambah makna" yang isinya sudah ada (beda kapital /
    // sama persis) tidak ditambahkan lagi.
    const seenFps = await loadMeaningFingerprints(db, word.id);

    for (const mc of changes.meanings) {
      if (mc.action === 'add' && !mc.meaningId) {
        const fp = meaningDeduplicationFingerprint({
          definition: mc.definition ?? '',
          translations: mc.translations ?? [],
          isHaveDefinition: true,
          isHaveTranslation: (mc.translations ?? []).length > 0,
        });
        if (seenFps.has(fp)) continue;
        seenFps.add(fp);
        const newMeaning = await db
          .insert(meanings)
          .values({
            wordId: word.id,
            wordClassId: mc.wordClassId ?? null,
            definition: mc.definition ?? '',
            orderIndex: existingMeanings.length,
            createdBy: reviewerId,
          })
          .returning({ id: meanings.id });
        const newMeaningId = newMeaning[0]?.id;
        if (mc.translations && mc.translations.length > 0) {
          for (const t of mc.translations) {
            await db
              .insert(meaningTranslations)
              .values({
                meaningId: newMeaningId!,
                languageId: t.languageId,
                translationText: t.translationText,
                translationType: t.translationType ?? 'direct',
                createdBy: reviewerId,
              })
              .onConflictDoNothing();
          }
        }
        changesApplied++;
      } else if (mc.action === 'update' && mc.meaningId) {
        const existing = existingMap.get(mc.meaningId);
        if (existing) {
          if (mc.definition !== undefined && mc.definition !== existing.definition) {
            await db
              .update(meanings)
              .set({ definition: mc.definition, updatedAt: new Date() })
              .where(eq(meanings.id, mc.meaningId));
            changesApplied++;
          }
          if (mc.wordClassId !== undefined && mc.wordClassId !== existing.wordClassId) {
            await db
              .update(meanings)
              .set({ wordClassId: mc.wordClassId, updatedAt: new Date() })
              .where(eq(meanings.id, mc.meaningId));
            changesApplied++;
          }
          if (mc.translations && mc.translations.length > 0) {
            for (const t of mc.translations) {
              // #191: padanan bahasa yang sama SELALU diganti di baris yang sama,
              // kata terverifikasi maupun belum (restoreBaseline mengembalikan
              // lewat id). Dulu kata terverifikasi menambah baris baru -> makna
              // tampak bertambah setelah approve.
              const current = await db.query.meaningTranslations.findFirst({
                where: and(
                  eq(meaningTranslations.meaningId, mc.meaningId),
                  eq(meaningTranslations.languageId, t.languageId),
                  isNull(meaningTranslations.deletedAt),
                ),
              });
              if (current?.translationText === t.translationText) continue;
              // ponytail: unique (meaning_id, language_id, translation_text)
              // mencakup baris soft-deleted - teks yang pernah dipakai tidak
              // bisa di-UPDATE ke baris lain. Kalau baris (aktif/soft-delete)
              // sudah memegang teks baru: hidupkan baris itu, matikan baris
              // lama. Kalau belum ada sama sekali: UPDATE/INSERT bersih.
              const holder = await db.query.meaningTranslations.findFirst({
                where: and(
                  eq(meaningTranslations.meaningId, mc.meaningId),
                  eq(meaningTranslations.languageId, t.languageId),
                  eq(meaningTranslations.translationText, t.translationText),
                ),
              });
              if (holder) {
                if (holder.deletedAt) {
                  await db
                    .update(meaningTranslations)
                    .set({ deletedAt: null, updatedAt: new Date() })
                    .where(eq(meaningTranslations.id, holder.id));
                }
                if (current) {
                  await db
                    .update(meaningTranslations)
                    .set({ deletedAt: new Date() })
                    .where(eq(meaningTranslations.id, current.id));
                }
              } else if (current) {
                await db
                  .update(meaningTranslations)
                  .set({ translationText: t.translationText, updatedAt: new Date() })
                  .where(eq(meaningTranslations.id, current.id));
              } else {
                await db
                  .insert(meaningTranslations)
                  .values({
                    meaningId: mc.meaningId,
                    languageId: t.languageId,
                    translationText: t.translationText,
                    translationType: t.translationType ?? 'direct',
                    createdBy: reviewerId,
                  })
                  .onConflictDoNothing();
              }
              changesApplied++;
            }
          }
        }
      } else if (mc.action === 'delete' && mc.meaningId) {
        await db
          .update(meanings)
          .set({ deletedAt: new Date(), deletedBy: reviewerId })
          .where(eq(meanings.id, mc.meaningId));
        changesApplied++;
      }
    }
  }

  if (changes.categoryIdsToAdd && changes.categoryIdsToAdd.length > 0) {
    for (const catId of changes.categoryIdsToAdd) {
      const exists = await db.query.wordCategories.findFirst({
        where: and(
          eq(wordCategories.wordId, word.id),
          eq(wordCategories.categoryId, catId),
          isNull(wordCategories.deletedAt),
        ),
      });
      if (!exists) {
        await db
          .insert(wordCategories)
          .values({ wordId: word.id, categoryId: catId })
          .onConflictDoNothing();
        changesApplied++;
      }
    }
  }

  if (changes.categoryIdsToRemove && changes.categoryIdsToRemove.length > 0) {
    for (const catId of changes.categoryIdsToRemove) {
      await db
        .update(wordCategories)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(wordCategories.wordId, word.id),
            eq(wordCategories.categoryId, catId),
            isNull(wordCategories.deletedAt),
          ),
        );
      changesApplied++;
    }
  }

  // Relations (Form A link + Form B lemma - resolve/create saat approve)
  const relationAudit: { added: unknown[]; removed: unknown[] } = { added: [], removed: [] };
  if (changes.relations?.length) {
    for (const rel of changes.relations) {
      // Form B: lemma → id (buat kata baru bila belum ada).
      let targetId = rel.wordId;
      if (!targetId && rel.lemma) {
        const resolved = await resolveOrCreateTarget(word, rel.lemma, suggestion.userId, reviewerId);
        targetId = resolved.id;
        if (resolved.created) {
          createdWords.push({ id: resolved.id, lemma: resolved.lemma });
          changesApplied++;
        }
      }
      // Self-relation (termasuk lemma yang resolve ke kata ini): skip, bukan 500.
      if (!targetId || targetId === word.id) continue;
      if (rel.action === 'add') {
        // PRD relasi-lemma 5.2: derived_from - satu akar utama, tanpa siklus.
        if (rel.relationType === 'derived_from') {
          const [existingRoot] = await db
            .select({ id: lexicalRelations.id, targetWordId: lexicalRelations.targetWordId })
            .from(lexicalRelations)
            .where(
              and(
                eq(lexicalRelations.sourceWordId, word.id),
                eq(lexicalRelations.relationType, 'derived_from'),
                isNull(lexicalRelations.deletedAt),
              ),
            )
            .limit(1);
          if (existingRoot && existingRoot.targetWordId !== targetId) {
            throw new BadRequestError(
              'VALIDATION_ERROR',
              'Kata ini sudah punya akar lain. Hapus akar lama dulu sebelum mengganti.',
              [{ field: 'relations', message: 'Satu kata turunan hanya boleh punya satu akar' }],
            );
          }
          const cycle = await db.all<{ hit: number }>(sql`
            WITH RECURSIVE walk(word_id) AS (
              SELECT ${targetId}
              UNION
              SELECT lr.source_word_id
              FROM lexical_relations lr
              JOIN walk w ON lr.target_word_id = w.word_id
              WHERE lr.relation_type = 'derived_from'
                AND lr.deleted_at IS NULL
                AND lr.status = 'published'
                AND w.word_id != ${word.id}
              LIMIT 1000
            )
            SELECT 1 AS hit FROM walk WHERE word_id = ${word.id} LIMIT 1
          `);
          if (cycle.length > 0) {
            throw new BadRequestError(
              'VALIDATION_ERROR',
              'Relasi akar ini akan membuat siklus. Periksa rujukan akarnya.',
              [{ field: 'relations', message: 'Relasi akar menutup siklus' }],
            );
          }
        }
        await db
          .insert(lexicalRelations)
          .values({
            sourceWordId: word.id,
            targetWordId: targetId,
            relationType: rel.relationType,
            createdBy: reviewerId,
          })
          .onConflictDoNothing();
        if (rel.relationType === 'synonym') {
          await db
            .insert(lexicalRelations)
            .values({
              sourceWordId: targetId,
              targetWordId: word.id,
              relationType: 'synonym',
              createdBy: reviewerId,
            })
            .onConflictDoNothing();
        }
        relationAudit.added.push(rel);
        changesApplied++;
      } else if (rel.action === 'remove') {
        await db
          .update(lexicalRelations)
          .set({ deletedAt: new Date(), deletedBy: reviewerId })
          .where(
            and(
              eq(lexicalRelations.sourceWordId, word.id),
              eq(lexicalRelations.targetWordId, targetId),
              eq(lexicalRelations.relationType, rel.relationType),
              isNull(lexicalRelations.deletedAt),
            ),
          );
        if (rel.relationType === 'synonym') {
          await db
            .update(lexicalRelations)
            .set({ deletedAt: new Date(), deletedBy: reviewerId })
          .where(
            and(
              eq(lexicalRelations.sourceWordId, targetId),
              eq(lexicalRelations.targetWordId, word.id),
              eq(lexicalRelations.relationType, 'synonym'),
              isNull(lexicalRelations.deletedAt),
            ),
          );
        }
        relationAudit.removed.push(rel);
        changesApplied++;
      }
    }
    newAudit.relations = relationAudit;
  }

  // Variants
  const variantAudit: { added: unknown[]; removed: unknown[] } = { added: [], removed: [] };
  if (changes.variants?.length) {
    for (const v of changes.variants) {
      const form = v.form.trim();
      if (v.action === 'add') {
        if (form.toLowerCase() === word.lemma.toLowerCase()) continue;
        await db
          .insert(wordVariants)
          .values({
            wordId: word.id,
            form,
            variantType: v.variantType ?? 'alternative',
            dialectId: v.dialectId ?? null,
            createdBy: reviewerId,
          })
          .onConflictDoNothing();
        variantAudit.added.push({ form, variant_type: v.variantType ?? 'alternative' });
        changesApplied++;
      } else if (v.action === 'remove') {
        const conditions = [
          eq(wordVariants.wordId, word.id),
          eq(wordVariants.form, form),
          isNull(wordVariants.deletedAt),
        ];
        await db
          .update(wordVariants)
          .set({ deletedAt: new Date(), deletedBy: reviewerId })
          .where(and(...conditions));
      variantAudit.removed.push({ form, variant_type: v.variantType ?? 'alternative' });
      changesApplied++;
    }
  }
    newAudit.variants = variantAudit;
  }

  // PRD relasi-lemma: kelompok makna. Approve verifikator = publish
  // (moderasi sudah lewat antrean usulan ini); relasi status mengikuti
  // konvensi lexical_relations (default kolom = published).
const groupAudit: {
  joined: string[];
  left: string[];
  created: string[];
  createdNewWords?: string[];
} = {
  joined: [],
  left: [],
  created: [],
};
  if (changes.groups?.length) {
    for (const g of changes.groups) {
      if (g.action === 'add' && g.groupId) {
        const [group] = await db
          .select({ id: wordGroups.id })
          .from(wordGroups)
          .where(and(eq(wordGroups.id, g.groupId), isNull(wordGroups.deletedAt)))
          .limit(1);
        if (!group) continue; // kelompok sudah dihapus - skip, bukan gagal
        // Baris yang pernah dikeluarkan (soft-delete) dihidupkan lagi -
        // unique (group_id, word_id) tidak memperhitungkan deleted_at, jadi
        // insert baru akan ditolak diam-diam.
        const [existing] = await db
          .select({ id: wordGroupMembers.id, deletedAt: wordGroupMembers.deletedAt })
          .from(wordGroupMembers)
          .where(
            and(
              eq(wordGroupMembers.groupId, g.groupId),
              eq(wordGroupMembers.wordId, word.id),
            ),
          )
          .limit(1);
        if (existing) {
          if (!existing.deletedAt) continue; // sudah anggota - tidak ada perubahan
          await db
            .update(wordGroupMembers)
            .set({ deletedAt: null, deletedBy: null, status: 'published', updatedAt: new Date() })
            .where(eq(wordGroupMembers.id, existing.id));
        } else {
          await db
            .insert(wordGroupMembers)
            .values({
              groupId: g.groupId,
              wordId: word.id,
              status: 'published',
              createdBy: reviewerId,
            })
            .onConflictDoNothing();
        }
        groupAudit.joined.push(g.groupId);
        changesApplied++;
} else if (g.action === 'add' && !g.groupId) {
  const name = g.name?.trim();
  if (!name) continue;
  const [newGroup] = await db
    .insert(wordGroups)
    .values({
      name,
      description: g.description ?? null,
      status: 'published',
      createdBy: reviewerId,
    })
    .returning({ id: wordGroups.id });
  // Anggota dari lemma: resolve-or-create (kata baru bila belum ada di kamus).
  const newGroupLemmas: string[] = [];
  const memberIds = [...new Set([...(g.wordIds ?? []), word.id])];
  for (const lemma of g.lemmas ?? []) {
    const resolved = await resolveOrCreateTarget(word, lemma, suggestion.userId, reviewerId);
    if (resolved.created) {
      createdWords.push({ id: resolved.id, lemma: resolved.lemma });
      changesApplied++;
      newGroupLemmas.push(resolved.lemma);
    }
    if (resolved.id !== word.id) memberIds.push(resolved.id);
  }
  await db
    .insert(wordGroupMembers)
    .values(
      memberIds.map((id) => ({
        groupId: newGroup.id,
        wordId: id,
        status: 'published',
        createdBy: reviewerId,
      })),
    )
    .onConflictDoNothing();
  groupAudit.created.push(name);
  if (newGroupLemmas.length > 0) {
    groupAudit.createdNewWords = [
      ...(Array.isArray(groupAudit.createdNewWords) ? groupAudit.createdNewWords : []),
      ...newGroupLemmas,
    ];
  }
  changesApplied++;
} else if (g.action === 'remove' && g.groupId) {
        await db
          .update(wordGroupMembers)
          .set({ deletedAt: new Date(), deletedBy: reviewerId })
          .where(
            and(
              eq(wordGroupMembers.groupId, g.groupId),
              eq(wordGroupMembers.wordId, word.id),
              isNull(wordGroupMembers.deletedAt),
            ),
          );
        groupAudit.left.push(g.groupId);
        changesApplied++;
      }
    }
    if (groupAudit.joined.length || groupAudit.left.length || groupAudit.created.length) {
      newAudit.groups = groupAudit;
    }
  }

  // Images
  const imageAudit: { added: unknown[]; removed: unknown[]; set_primary: unknown[] } = {
    added: [],
    removed: [],
    set_primary: [],
  };
  if (changes.images?.length) {
    for (const img of changes.images) {
      if (img.action === 'add' && img.url && img.providerFileId) {
        if (img.isPrimary) {
          await db
            .update(wordImages)
            .set({ isPrimary: false })
            .where(and(eq(wordImages.wordId, word.id), isNull(wordImages.deletedAt)));
        }
        const provider = resolveWordImageProvider(img.provider, 'github');
        // apply_pending: ImageKit tetap staging (belum diverifikasi).
        // approve / correct: provider sudah github setelah promote, atau stock.
        const isVerified = provider !== 'imagekit';
        await db
          .insert(wordImages)
          .values({
            wordId: word.id,
            url: img.url,
            provider,
            providerFileId: img.providerFileId,
            altText: img.altText ?? null,
            isPrimary: img.isPrimary ?? false,
            createdBy: reviewerId,
            status: 'published',
            isVerified,
          })
          .onConflictDoNothing();
        imageAudit.added.push({ url: img.url, is_primary: img.isPrimary ?? false, provider });
        changesApplied++;
      } else if (img.action === 'remove' && img.imageId) {
        await db
          .update(wordImages)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(wordImages.id, img.imageId),
              eq(wordImages.wordId, word.id),
              isNull(wordImages.deletedAt),
            ),
          );
        imageAudit.removed.push({ image_id: img.imageId });
        changesApplied++;
      } else if (img.action === 'set_primary' && img.imageId) {
        await db
          .update(wordImages)
          .set({ isPrimary: false })
          .where(and(eq(wordImages.wordId, word.id), isNull(wordImages.deletedAt)));
        await db
          .update(wordImages)
          .set({ isPrimary: true })
          .where(
            and(
              eq(wordImages.id, img.imageId),
              eq(wordImages.wordId, word.id),
              isNull(wordImages.deletedAt),
            ),
          );
        imageAudit.set_primary.push({ image_id: img.imageId });
        changesApplied++;
      }
    }
      if (imageAudit.removed.length > 0) await ensurePrimaryImage(word.id);
      newAudit.images = imageAudit;
      if (createdWords.length > 0) {
        // Jejak kata yang dibuat approve: dari usulan relasi/kelompok lemma
        // target yang belum ada saat approve.
        newAudit.created_words = createdWords;
      }
  }

  if (action !== 'apply_pending') {
    const newStatus = action === 'approve' ? 'approved' : 'corrected';
    await db
      .update(wordEditSuggestions)
      .set({
        status: newStatus,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(wordEditSuggestions.id, suggestionId), isNull(wordEditSuggestions.deletedAt)));
  }

  await db
    .insert(auditLogs)
    .values({
      userId: reviewerId,
      action: `suggest_edit_${action}`,
      entityType: 'word',
      entityId: word.id,
      oldData: oldAudit,
      newData: newAudit,
      requestId: null,
      sourceContributionId: suggestionId,
    })
    .onConflictDoNothing();

  return {
    applied: true,
    changesApplied,
    wordLemma: (changes.lemma ?? word.lemma) as string,
    wordId: word.id,
    createdWords,
  };
}
