/** Shared helpers for word-suggestion repository. */
import { eq, and, isNull, inArray, asc, sql } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { words, meanings, meaningTranslations, examples, pronunciations, wordCategories, wordClasses, lexicalRelations, wordVariants, wordImages, wordGroups, wordGroupMembers } from '@/shared/database/drizzle/schema';
import type { CurrentWordSnapshot, DiffResult, ProposedChanges } from '../domain/entities/word-suggestion.entity';
import { toUsageLabels } from '@/modules/word/infrastructure/word-row-mappers';
export async function getCurrentWordSnapshot(wordId: string): Promise<CurrentWordSnapshot | null> {
  const [word] = await db
    .select({
      lemma: words.lemma,
      notes: words.notes,
      wordType: words.wordType,
      languageId: words.languageId,
      usageLabels: words.usageLabels,
    })
    .from(words)
    .where(and(eq(words.id, wordId), isNull(words.deletedAt)))
    .limit(1);
  if (!word) return null;

  const meaningRows = await db
    .select({
      id: meanings.id,
      definition: meanings.definition,
      wordClassId: meanings.wordClassId,
      wordClassCode: wordClasses.code,
      wordClassName: wordClasses.name,
      wordClassAlias: wordClasses.alias,
    })
    .from(meanings)
    .leftJoin(wordClasses, eq(meanings.wordClassId, wordClasses.id))
    .where(and(eq(meanings.wordId, wordId), isNull(meanings.deletedAt)))
    .orderBy(asc(meanings.orderIndex));

  const meaningIds = meaningRows.map((m) => m.id);
  const translations =
    meaningIds.length === 0
      ? []
      : await db
          .select({
            meaningId: meaningTranslations.meaningId,
            translationText: meaningTranslations.translationText,
          })
          .from(meaningTranslations)
          .where(
            and(
              inArray(meaningTranslations.meaningId, meaningIds),
              isNull(meaningTranslations.deletedAt),
            ),
          );

  const byMeaning = new Map<string, { translationText: string }[]>();
  for (const t of translations) {
    const list = byMeaning.get(t.meaningId) ?? [];
    list.push({ translationText: t.translationText });
    byMeaning.set(t.meaningId, list);
  }

  const exampleRows =
    meaningIds.length === 0
      ? []
      : await db
          .select({
            id: examples.id,
            meaningId: examples.meaningId,
            sourceSentence: examples.sourceSentence,
            targetSentence: examples.targetSentence,
          })
          .from(examples)
          .where(
            and(
              inArray(examples.meaningId, meaningIds),
              eq(examples.status, 'published'),
              isNull(examples.deletedAt),
            ),
          );

  const pronunciationRows = await db
    .select({
      id: pronunciations.id,
      notation: pronunciations.notation,
      value: pronunciations.value,
      dialectId: pronunciations.dialectId,
    })
    .from(pronunciations)
    .where(
      and(
        eq(pronunciations.wordId, wordId),
        eq(pronunciations.status, 'published'),
        isNull(pronunciations.deletedAt),
      ),
    );

  const catRows = await db
    .select({ categoryId: wordCategories.categoryId })
    .from(wordCategories)
    .where(and(eq(wordCategories.wordId, wordId), isNull(wordCategories.deletedAt)));

  const relRows = await db
    .select({
      relationType: lexicalRelations.relationType,
      wordId: lexicalRelations.targetWordId,
      lemma: words.lemma,
    })
    .from(lexicalRelations)
    .innerJoin(words, eq(words.id, lexicalRelations.targetWordId))
    .where(
      and(eq(lexicalRelations.sourceWordId, wordId), isNull(lexicalRelations.deletedAt)),
    );

  const variantRows = await db
    .select({
      form: wordVariants.form,
      variantType: wordVariants.variantType,
      dialectId: wordVariants.dialectId,
    })
    .from(wordVariants)
    .where(and(eq(wordVariants.wordId, wordId), isNull(wordVariants.deletedAt)));

  const imageRows = await db
    .select({
      id: wordImages.id,
      url: wordImages.url,
      isPrimary: wordImages.isPrimary,
      altText: wordImages.altText,
    })
    .from(wordImages)
    .where(and(eq(wordImages.wordId, wordId), isNull(wordImages.deletedAt)));

  // PRD relasi-lemma: kelompok makna published yang memuat kata ini.
  const groupRows = await db
    .select({
      groupId: wordGroups.id,
      name: wordGroups.name,
      memberWordId: wordGroupMembers.wordId,
    })
    .from(wordGroupMembers)
    .innerJoin(
      wordGroups,
      and(
        eq(wordGroups.id, wordGroupMembers.groupId),
        eq(wordGroups.status, 'published'),
        isNull(wordGroups.deletedAt),
      ),
    )
    .where(
      and(
        eq(wordGroupMembers.wordId, wordId),
        eq(wordGroupMembers.status, 'published'),
        isNull(wordGroupMembers.deletedAt),
      ),
    );

  const groupMap = new Map<string, { groupId: string; name: string; memberWordIds: string[] }>();
  for (const g of groupRows) {
    const cur = groupMap.get(g.groupId) ?? {
      groupId: g.groupId,
      name: g.name,
      memberWordIds: [],
    };
    cur.memberWordIds.push(g.memberWordId);
    groupMap.set(g.groupId, cur);
  }

  return {
    lemma: word.lemma,
    notes: word.notes,
    wordType: word.wordType,
    languageId: word.languageId,
    meanings: meaningRows.map((m) => ({
      id: m.id,
      wordClassId: m.wordClassId,
      wordClass:
        m.wordClassCode && m.wordClassName
          ? {
              code: m.wordClassCode,
              name: m.wordClassAlias?.trim() || m.wordClassName,
            }
          : { code: '', name: '' },
      definition: m.definition,
      translations: byMeaning.get(m.id) ?? [],
    })),
    examples: exampleRows.map((ex) => ({
      id: ex.id,
      meaningId: ex.meaningId,
      sourceSentence: ex.sourceSentence,
      targetSentence: ex.targetSentence,
    })),
    pronunciations: pronunciationRows.map((p) => ({
      id: p.id,
      notation: p.notation,
      value: p.value,
      dialectId: p.dialectId,
    })),
    categoryIds: catRows.map((c) => c.categoryId),
    usageLabels: toUsageLabels(word.usageLabels),
    relations: relRows.map((r) => ({
      relationType: r.relationType,
      wordId: r.wordId,
      lemma: r.lemma,
    })),
    variants: variantRows.map((v) => ({
      form: v.form,
      variantType: v.variantType,
      dialectId: v.dialectId,
    })),
    images: imageRows.map((i) => ({
      id: i.id,
      url: i.url,
      isPrimary: i.isPrimary,
      altText: i.altText,
    })),
    groups: [...groupMap.values()],
  };
}

async function relationLemmas(
  proposed: ProposedChanges,
  current: CurrentWordSnapshot,
): Promise<Map<string, string>> {
  const known = new Map(current.relations.map((relation) => [relation.wordId, relation.lemma]));
  const missing = [
    ...new Set(
      (proposed.relations ?? [])
        .map((relation) => relation.wordId)
        .filter((wordId): wordId is string => !!wordId && !known.get(wordId)),
    ),
  ];
  if (missing.length === 0) return known;

  const rows = await db
    .select({ id: words.id, lemma: words.lemma })
    .from(words)
    .where(inArray(words.id, missing));
  for (const row of rows) known.set(row.id, row.lemma);
  return known;
}

async function classLabels(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: wordClasses.id, name: wordClasses.name, alias: wordClasses.alias })
    .from(wordClasses)
    .where(inArray(wordClasses.id, unique));
  return new Map(rows.map((row) => [row.id, row.alias?.trim() || row.name]));
}

export async function buildDiff(proposed: ProposedChanges, current: CurrentWordSnapshot): Promise<DiffResult> {
  const lemma: DiffResult['lemma'] = {
    current: current.lemma,
    proposed: proposed.lemma ?? null,
    changed: proposed.lemma !== undefined && proposed.lemma !== current.lemma,
  };
  const notes: DiffResult['notes'] = {
    current: current.notes,
    proposed: proposed.notes ?? null,
    changed: proposed.notes !== undefined && proposed.notes !== current.notes,
  };
  const wordType: DiffResult['wordType'] = {
    current: current.wordType,
    proposed: proposed.wordType ?? null,
    changed: proposed.wordType !== undefined && proposed.wordType !== current.wordType,
  };
  const labels = await classLabels(
    (proposed.meanings ?? []).flatMap((mc) => (mc.wordClassId ? [mc.wordClassId] : [])),
  );

  const meaningsDiff: DiffResult['meanings'] = [];
  for (const mc of proposed.meanings ?? []) {
    const changes: DiffResult['meanings'][0]['changes'] = [];
    if (mc.action === 'add') {
      if (mc.definition !== undefined) {
        changes.push({ current: null, proposed: mc.definition, changed: true });
      }
      meaningsDiff.push({ meaningId: null, changes });
      continue;
    }
    if (!mc.meaningId) continue;
    const cur = current.meanings.find((m) => m.id === mc.meaningId);
    if (mc.wordClassId !== undefined) {
      const currentId = cur?.wordClassId ?? null;
      const proposedLabel = labels.get(mc.wordClassId) ?? null;
      const currentLabel = cur?.wordClass.name?.trim() || null;
      if (proposedLabel) {
        changes.push({
          label: 'Kelas kata',
          current: currentLabel,
          proposed: proposedLabel,
          changed: mc.wordClassId !== currentId,
        });
      }
    }
    if (mc.definition !== undefined) {
      const d = cur?.definition ?? null;
      changes.push({
        label: 'Definisi',
        current: d,
        proposed: mc.definition,
        changed: mc.definition !== d,
      });
    }
    if (mc.translations) {
      for (const t of mc.translations) {
        changes.push({ current: null, proposed: t.translationText, changed: true });
      }
    }
    meaningsDiff.push({ meaningId: mc.meaningId, changes });
  }

  const examplesDiff: DiffResult['examples'] = [];
  for (const ec of proposed.examples ?? []) {
    if (!ec.exampleId) continue;
    const cur = current.examples.find((ex) => ex.id === ec.exampleId);
    const changes: DiffResult['examples'][0]['changes'] = [];
    if (ec.action === 'delete') {
      // Penghapusan contoh: reviewer lihat baris "dihapus", bukan diff kalimat.
      changes.push({
        label: 'Kalimat contoh',
        current: cur?.sourceSentence ?? null,
        proposed: null,
        changed: true,
      });
      examplesDiff.push({ exampleId: ec.exampleId, changes });
      continue;
    }
    if (ec.sourceSentence !== undefined) {
      const d = cur?.sourceSentence ?? null;
      changes.push({
        label: 'Kalimat contoh',
        current: d,
        proposed: ec.sourceSentence,
        changed: ec.sourceSentence !== d,
      });
    }
    if (ec.targetSentence !== undefined) {
      const d = cur?.targetSentence ?? null;
      changes.push({
        label: 'Arti contoh',
        current: d,
        proposed: ec.targetSentence,
        changed: (ec.targetSentence ?? '') !== (d ?? ''),
      });
    }
    examplesDiff.push({ exampleId: ec.exampleId, changes });
  }

  const pronunciationsDiff: DiffResult['pronunciations'] = [];
  for (const pc of proposed.pronunciations ?? []) {
    if (pc.action !== 'update' || !pc.pronunciationId) continue;
    const cur = current.pronunciations.find((p) => p.id === pc.pronunciationId);
    const d = cur?.value ?? null;
    pronunciationsDiff.push({
      pronunciationId: pc.pronunciationId,
      changes: [
        {
          label: 'Pelafalan',
          current: d,
          proposed: pc.value,
          changed: pc.value !== d,
        },
      ],
    });
  }

  const curCats = new Set(current.categoryIds);
  const curUsage = new Set(current.usageLabels);
  const lemmaOf = await relationLemmas(proposed, current);
  // Form B (lemma): kata yang sudah ada → word_id + lemma; belum ada →
  // lemma + new_word=true (dibuat saat approve).
  const lemmaIdOf = new Map<string, string>();
  const relAddedLemmas = [
    ...new Set(
      (proposed.relations ?? [])
        .filter((r) => r.action === 'add' && !r.wordId && r.lemma)
        .map((r) => r.lemma!.trim().toLowerCase()),
    ),
  ];
  if (relAddedLemmas.length > 0) {
    const rows = await db
      .select({ id: words.id, lemma: words.lemma })
      .from(words)
      .where(
        and(
          eq(words.languageId, current.languageId),
          inArray(sql`lower(${words.lemma})`, relAddedLemmas),
          isNull(words.deletedAt),
        ),
      );
    for (const row of rows) lemmaIdOf.set(row.lemma.toLowerCase(), row.id);
  }
  const relAdded = (proposed.relations ?? [])
    .filter((r) => r.action === 'add')
    .map((r) => {
      if (r.wordId) {
        return { relationType: r.relationType, wordId: r.wordId, lemma: lemmaOf.get(r.wordId) };
      }
      const existingId = lemmaIdOf.get(r.lemma!.trim().toLowerCase());
      return existingId
        ? { relationType: r.relationType, wordId: existingId, lemma: r.lemma }
        : { relationType: r.relationType, lemma: r.lemma, newWord: true };
    });
  const relRemoved = (proposed.relations ?? [])
    .filter((r) => r.action === 'remove' && r.wordId)
    .map((r) => ({
      relationType: r.relationType,
      wordId: r.wordId!,
      lemma: lemmaOf.get(r.wordId!),
    }));

  // PRD relasi-lemma: diff keanggotaan kelompok makna.
  const curGroups = new Map(current.groups.map((g) => [g.groupId, g.name]));
  const groupIds = [
    ...new Set((proposed.groups ?? []).map((g) => g.groupId).filter((id): id is string => !!id)),
  ];
  const groupNames = new Map<string, string>();
  if (groupIds.length > 0) {
    const rows = await db
      .select({ id: wordGroups.id, name: wordGroups.name })
      .from(wordGroups)
      .where(and(inArray(wordGroups.id, groupIds), isNull(wordGroups.deletedAt)));
    for (const row of rows) groupNames.set(row.id, row.name);
  }
  const newGroupWordIds = [
    ...new Set(
      (proposed.groups ?? [])
        .filter((g) => g.action === 'add' && !g.groupId)
        .flatMap((g) => g.wordIds ?? []),
    ),
  ];
  const newGroupLemmas = new Map<string, string>();
  if (newGroupWordIds.length > 0) {
    const rows = await db
      .select({ id: words.id, lemma: words.lemma })
      .from(words)
      .where(inArray(words.id, newGroupWordIds));
    for (const row of rows) newGroupLemmas.set(row.id, row.lemma);
  }
  const groupsDiff: DiffResult['groups'] = { joined: [], left: [], created: [] };
  for (const g of proposed.groups ?? []) {
    if (g.action === 'add' && g.groupId) {
      if (curGroups.has(g.groupId)) continue; // sudah anggota - bukan perubahan
      groupsDiff.joined.push({
        groupId: g.groupId,
        name: groupNames.get(g.groupId) ?? curGroups.get(g.groupId) ?? g.groupId,
      });
    } else if (g.action === 'add' && !g.groupId) {
      groupsDiff.created.push({
        name: g.name ?? '',
        memberLemmas: (g.wordIds ?? [])
          .map((id) => newGroupLemmas.get(id) ?? id)
          // Kata ini sendiri tidak ditampilkan sebagai anggota "lain".
          .filter((lemma) => lemma !== current.lemma),
        // Anggota dari lemma yang belum ada di kamus (dibuat saat approve).
        newWordLemmas: (g.lemmas ?? []).map((l) => l.trim()).filter(Boolean),
      });
    } else if (g.action === 'remove' && g.groupId) {
      if (!curGroups.has(g.groupId)) continue; // bukan anggota - bukan perubahan
      groupsDiff.left.push({ groupId: g.groupId, name: groupNames.get(g.groupId) ?? g.groupId });
    }
  }

  return {
    lemma,
    notes,
    wordType,
    meanings: meaningsDiff,
    examples: examplesDiff,
    pronunciations: pronunciationsDiff,
    categories: {
      added: (proposed.categoryIdsToAdd ?? []).filter((c) => !curCats.has(c)),
      removed: (proposed.categoryIdsToRemove ?? []).filter((c) => curCats.has(c)),
    },
    usageLabels: {
      added: (proposed.usageLabelsToAdd ?? []).filter((l) => !curUsage.has(l)),
      removed: (proposed.usageLabelsToRemove ?? []).filter((l) => curUsage.has(l)),
    },
    relations: { added: relAdded, removed: relRemoved },
    variants: {
      added: (proposed.variants ?? [])
        .filter((v) => v.action === 'add')
        .map((v) => ({ form: v.form, variantType: v.variantType ?? 'alternative' })),
      removed: (proposed.variants ?? [])
        .filter((v) => v.action === 'remove')
        .map((v) => ({ form: v.form, variantType: v.variantType ?? 'alternative' })),
    },
    images: {
      added: (proposed.images ?? [])
        .filter((i) => i.action === 'add' && i.url)
        .map((i) => ({
          url: i.url!,
          isPrimary: i.isPrimary ?? false,
          provider: i.provider ?? null,
          providerFileId: i.providerFileId ?? null,
        })),
      removed: (proposed.images ?? [])
        .filter((i) => i.action === 'remove' && i.imageId)
        .map((i) => ({ imageId: i.imageId! })),
      setPrimary: (proposed.images ?? [])
        .filter((i) => i.action === 'set_primary' && i.imageId)
        .map((i) => ({ imageId: i.imageId! })),
    },
    groups: groupsDiff,
  };
}

export function asProposed(raw: unknown): ProposedChanges {
  return (raw ?? {}) as ProposedChanges;
}

