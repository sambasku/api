import { eq, and, desc, isNull, inArray, lt, or } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { words, wordEditSuggestions, users, auditLogs, wordImages, meanings } from '@/shared/database/drizzle/schema';
import type { WordSuggestionRepository, ChangeHistoryItem, SuggestionSource } from '../domain/repositories/word-suggestion.repository';
import type { WordEditSuggestion, SuggestionDetail, SuggestionSummary, ProposedChanges, SuggestionStatus, SuggestionReasonCode } from '../domain/entities/word-suggestion.entity';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/errors/app-error';
import { ActivityEventRepositoryImpl } from '@/modules/activity/infrastructure/activity-event.repository.impl';
import type { AppendActivityEventInput } from '@/modules/activity/domain/entities/activity-event.entity';
import { verifyProposedChanges } from '../application/utils/verify-proposed-changes';
import { isRevertibleForApplyPending } from '../application/utils/suggestion-category-shape';
import {
  LEGACY_REASON_CODES,
  REASON_CODE_LABELS,
  isSuggestionCategory,
} from '../domain/entities/word-suggestion.entity';

import { applyChangesToWord, assertWordTypeAllowsComponents } from '../application/utils/apply-changes-to-word';
import { assertProposedMeaningsUnique } from '../application/utils/suggestion-meaning-dedupe';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import {
  deleteProposedStagingImages,
  prepareProposedImagesForApprove,
} from '../application/utils/suggestion-image-moderation';
import {
  deleteStagingWordImage,
  promoteWordImageFromStaging,
} from '@/modules/contribution/application/utils/promote-word-image-staging';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';

import { getUserPublicLabel, getUserPublicLabels } from './suggestion-user-labels';
import { captureBaseline } from './suggestion-baseline';
import { assertProposedTargetsCurrent, restoreBaseline } from './suggestion-stale';
import {
  getCurrentWordSnapshot,
  buildDiff,
  asProposed,
} from './suggestion-snapshot-diff';

export class WordSuggestionRepositoryImpl implements WordSuggestionRepository {
  /** Event log feed (write-through, AGENTS.md #25). Best-effort. */
  private events = new ActivityEventRepositoryImpl(db);

  /** #56: nama tampilan pengusul - 1 select per approve, bukan read-path. */
  private async displayNameOf(userId: string): Promise<string | null> {
    try {
      const { users } = await import('@/shared/database/drizzle/schema');
      const [row] = await db
        .select({ displayName: users.displayName, username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return row?.displayName || row?.username || null;
    } catch {
      return null;
    }
  }

  private async emitEvent(input: AppendActivityEventInput): Promise<void> {
    try {
      // #56: verifikasi dengan pengusul → copy beku + supersede usulan lama.
      if (input.kind === 'word_verified' && input.proposedByName) {
        await this.events.append(input);
        return;
      }
      await this.events.append(input);
    } catch (err) {
      console.error('[activity-event] word-suggestion append gagal (diabaikan):', {
        kind: input.kind,
        targetId: input.targetId,
        err: err instanceof Error ? err.message : err,
      });
    }
  }

  constructor(
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly imageStorage: ImageStoragePort,
  ) {}

  async getWordUsageLabels(wordId: string): Promise<string[]> {
    const [row] = await db
      .select({ usageLabels: words.usageLabels })
      .from(words)
      .where(eq(words.id, wordId))
      .limit(1);
    return Array.isArray(row?.usageLabels) ? (row.usageLabels as string[]) : [];
  }

  async createSuggestion(
    userId: string,
    wordId: string,
    proposedChanges: ProposedChanges,
    reason: string,
    reasonCode: string,
    actorRole?: string,
  ): Promise<WordEditSuggestion> {
    const [word] = await db
      .select({
        id: words.id,
        lemma: words.lemma,
        notes: words.notes,
        wordType: words.wordType,
        status: words.status,
        isVerified: words.isVerified,
        createdBy: words.createdBy,
      })
      .from(words)
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)))
      .limit(1);
    if (!word) throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');
    if (word.status !== 'published') {
      throw new BadRequestError('WORD_NOT_PUBLISHED', 'Hanya kata yang tayang bisa diusulkan');
    }

    if (proposedChanges.wordType !== undefined && proposedChanges.wordType === word.wordType) {
      proposedChanges = { ...proposedChanges, wordType: undefined };
    }
    const validation = verifyProposedChanges(proposedChanges);
    if (!validation.valid) {
      const onlyEmpty = validation.errors.every((e) => e.field === 'proposed_changes');
      if (onlyEmpty) {
        throw new BadRequestError(
          'SUGGESTION_NO_CHANGES',
          'Tidak ada yang berubah dari data sekarang',
          [{ field: 'word_type', message: 'Jenis entri masih sama' }],
        );
      }
      throw new BadRequestError(
        'INVALID_SUGGESTION_CHANGES',
        'Perubahan tidak valid',
        validation.errors.map((e) => ({ field: e.field, message: e.message })),
      );
    }

    if (proposedChanges.wordType !== undefined) {
      await assertWordTypeAllowsComponents(wordId, proposedChanges.wordType);
    }

    // Tidak ada guard "kata sendiri": `created_by` itu atribusi, bukan
    // kepemilikan. Semua usulan tetap masuk antrean verifikator, dan jalur
    // auto-publish (applyPendingNow) sudah dikunci ke kategori revertible +
    // kata belum terverifikasi - moderasi tidak terlewati.

    // Kategori: satu pending per kata per kategori. Kode lama (campuran)
    // menahan dan tertahan oleh semua usulan.
    const isCategory = isSuggestionCategory(reasonCode);
    const [open] = await db
      .select({ id: wordEditSuggestions.id })
      .from(wordEditSuggestions)
      .where(
        and(
          eq(wordEditSuggestions.wordId, wordId),
          eq(wordEditSuggestions.status, 'pending'),
          isNull(wordEditSuggestions.deletedAt),
          isCategory
            ? or(
                eq(wordEditSuggestions.reasonCode, reasonCode),
                inArray(wordEditSuggestions.reasonCode, [...LEGACY_REASON_CODES]),
              )
            : undefined,
        ),
      )
      .limit(1);
    if (open) {
      const label = isCategory
        ? `usulan ${REASON_CODE_LABELS[reasonCode as SuggestionReasonCode].toLowerCase()}`
        : 'usulan';
      throw new ConflictError(
        'SUGGESTION_ALREADY_PENDING',
        `Kata ini sudah punya ${label} yang belum selesai. Tunggu pemeriksaan tim sebelum mengirim usulan lain.`,
      );
    }

    await assertProposedTargetsCurrent(wordId, proposedChanges);
    // Sebelum insert dan sebelum event: duplikat tidak boleh mengisi slot
    // "satu usulan pending" dan tidak boleh masuk feed.
    await assertProposedMeaningsUnique(db, { id: word.id, lemma: word.lemma }, proposedChanges);

    const selfApply = Boolean(actorRole && isVerifierRole(actorRole));
    // Kontributor pada kata belum verified: tayang dulu, antrean tetap pending,
    // hanya jika penolakan bisa mengembalikan semuanya.
    // Verifikator: skip apply_pending - langsung approve di bawah.
    const applyPendingNow =
      !selfApply && !word.isVerified && isRevertibleForApplyPending(proposedChanges);
    const baseline = applyPendingNow
      ? await captureBaseline(wordId, word.lemma, word.notes, word.isVerified, word.wordType)
      : null;

    const [suggestion] = await db
      .insert(wordEditSuggestions)
      .values({
        userId,
        wordId,
        proposedChanges: proposedChanges as unknown as Record<string, unknown>,
        reason,
        reasonCode,
        status: 'pending',
        ...(baseline ? { baselineSnapshot: baseline } : {}),
      })
      .returning();

    // Event feed: user mengusulkan perubahan (suggestion_created)
    await this.emitEvent({
      kind: 'suggestion_created',
      actorId: userId,
      targetWordId: wordId,
      targetId: suggestion.id,
      dedupeKey: `suggestion:${suggestion.id}`,
    });

    let finalStatus: SuggestionStatus = 'pending';
    let reviewedBy: string | null = null;
    let reviewedAt: Date | null = null;

    if (selfApply) {
      // applyChangesToWord mensyaratkan status pending, jadi insert dulu pending
      // lalu approve. Kalau apply/verify gagal: soft-delete supaya tidak
      // meninggalkan orphan pending di antrean.
      try {
        const prepared = await prepareProposedImagesForApprove(proposedChanges, {
          publicImageStorage: this.publicImageStorage,
          imageStorage: this.imageStorage,
        });
        await applyChangesToWord(suggestion.id, userId, 'approve', undefined, prepared);
        // applyChangesToWord tidak set is_verified; verifikator = self-review (Section 22 parity).
        // Event feed: aksi "Lengkapi kata" verifikator (#86) + verifikasi bila
        // kata memang belum verified (stamp asli dipertahankan bila sudah ada).
        await this.emitEvent({
          kind: 'suggestion_selfapply',
          actorId: userId,
          targetWordId: wordId,
          targetId: suggestion.id,
          dedupeKey: `suggestion:${suggestion.id}`,
        });
        if (!word.isVerified) {
          await db
            .update(words)
            .set({
              isVerified: true,
              verifiedBy: userId,
              verifiedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(words.id, wordId));
          // #56: pengusul = pembuat kata (bila bukan diri verifikator).
          const proposedByName =
            word.createdBy && word.createdBy !== userId
              ? await this.displayNameOf(word.createdBy)
              : null;
          await this.emitEvent({
            kind: 'word_verified',
            actorId: userId,
            targetWordId: wordId,
            targetId: wordId,
            dedupeKey: `word_verified:${wordId}`,
            ...(proposedByName ? { proposedByName } : {}),
          });
        }
        finalStatus = 'approved';
        reviewedBy = userId;
        reviewedAt = new Date();
      } catch (err) {
        await db
          .update(wordEditSuggestions)
          .set({
            deletedAt: new Date(),
            deletedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(wordEditSuggestions.id, suggestion.id));
        await this.emitEvent({
          kind: 'suggestion_created',
          actorId: userId,
          targetWordId: wordId,
          targetId: suggestion.id,
          hidden: true,
          dedupeKey: `suggestion:${suggestion.id}`,
        });
        throw err;
      }
    } else if (applyPendingNow) {
      try {
        await applyChangesToWord(suggestion.id, userId, 'apply_pending');
      } catch (err) {
        await db
          .update(wordEditSuggestions)
          .set({
            deletedAt: new Date(),
            deletedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(wordEditSuggestions.id, suggestion.id));
        await this.emitEvent({
          kind: 'suggestion_created',
          actorId: userId,
          targetWordId: wordId,
          targetId: suggestion.id,
          hidden: true,
          dedupeKey: `suggestion:${suggestion.id}`,
        });
        throw err;
      }
    }

    await db.insert(auditLogs).values({
      userId,
      action: selfApply ? 'approve' : 'create',
      entityType: 'word_suggestion',
      entityId: suggestion.id,
      oldData: null,
      newData: {
        word_id: wordId,
        status: finalStatus,
        reason_code: reasonCode,
        ...(selfApply ? { self_applied: true } : {}),
      },
      requestId: null,
      sourceContributionId: suggestion.id,
    });

    const label = await getUserPublicLabel(userId);
    return {
      id: suggestion.id,
      userId: suggestion.userId,
      wordId: suggestion.wordId,
      proposedChanges,
      reason: suggestion.reason,
      reasonCode: (suggestion.reasonCode ?? 'other') as SuggestionReasonCode,
      status: finalStatus,
      reviewedBy,
      reviewedAt,
      reviewComment: suggestion.reviewComment,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
      deletedAt: suggestion.deletedAt,
      deletedBy: suggestion.deletedBy,
      contributorUsername: label.username,
      contributorDisplayName: label.displayName,
      wordLemma: word.lemma,
    };
  }

  async listSuggestions(opts: {
    status?: SuggestionStatus;
    limit: number;
    cursor?: string;
  }): Promise<{ items: SuggestionSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(opts.limit, 100);
    const conditions = [isNull(wordEditSuggestions.deletedAt)];
    if (opts.status) conditions.push(eq(wordEditSuggestions.status, opts.status));
    if (opts.cursor) conditions.push(lt(wordEditSuggestions.id, opts.cursor));

    const rows = await db
      .select({
        id: wordEditSuggestions.id,
        wordId: wordEditSuggestions.wordId,
        userId: wordEditSuggestions.userId,
        reason: wordEditSuggestions.reason,
        reasonCode: wordEditSuggestions.reasonCode,
        status: wordEditSuggestions.status,
        createdAt: wordEditSuggestions.createdAt,
        proposedChanges: wordEditSuggestions.proposedChanges,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
      })
      .from(wordEditSuggestions)
      .innerJoin(words, eq(wordEditSuggestions.wordId, words.id))
      .innerJoin(users, eq(wordEditSuggestions.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(wordEditSuggestions.id))
      .limit(limit + 1);

    const slice = rows.slice(0, limit);
    const items: SuggestionSummary[] = slice.map((s) => {
      const pc = asProposed(s.proposedChanges);
      const trimmed = s.displayName?.trim() || null;
      return {
        id: s.id,
        wordId: s.wordId,
        wordLemma: s.lemma,
        contributorId: s.userId,
        contributorUsername: s.username,
        contributorDisplayName: trimmed || s.username,
        reason: s.reason,
        reasonCode: (s.reasonCode ?? 'other') as SuggestionReasonCode,
        status: s.status as SuggestionStatus,
        createdAt: s.createdAt,
        summaryChanges: {
          lemma: pc.lemma ?? null,
          notes: pc.notes ?? null,
          wordType: pc.wordType ?? null,
          meaningsCount: pc.meanings?.length ?? 0,
          examplesCount: pc.examples?.length ?? 0,
          pronunciationsCount: pc.pronunciations?.length ?? 0,
          categoriesAdded: pc.categoryIdsToAdd?.length ?? 0,
          categoriesRemoved: pc.categoryIdsToRemove?.length ?? 0,
          relationsCount: pc.relations?.length ?? 0,
          variantsCount: pc.variants?.length ?? 0,
          imagesCount: pc.images?.length ?? 0,
          groupsCount: pc.groups?.length ?? 0,
        },
      };
    });

    const hasMore = rows.length > limit;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async listMine(opts: {
    userId: string;
    status?: SuggestionStatus;
    limit: number;
    cursor?: string;
  }): Promise<{
    items: Array<{
      id: string;
      wordId: string;
      wordLemma: string;
      status: SuggestionStatus;
      createdAt: Date;
      reviewComment: string | null;
      reason: string;
      reasonCode: SuggestionReasonCode;
      reviewedAt: Date | null;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const limit = Math.min(opts.limit, 100);
    const conditions = [
      isNull(wordEditSuggestions.deletedAt),
      eq(wordEditSuggestions.userId, opts.userId),
    ];
    if (opts.status) conditions.push(eq(wordEditSuggestions.status, opts.status));
    if (opts.cursor) conditions.push(lt(wordEditSuggestions.id, opts.cursor));

    const rows = await db
      .select({
        id: wordEditSuggestions.id,
        wordId: wordEditSuggestions.wordId,
        reason: wordEditSuggestions.reason,
        reasonCode: wordEditSuggestions.reasonCode,
        status: wordEditSuggestions.status,
        createdAt: wordEditSuggestions.createdAt,
        reviewComment: wordEditSuggestions.reviewComment,
        reviewedAt: wordEditSuggestions.reviewedAt,
        lemma: words.lemma,
      })
      .from(wordEditSuggestions)
      .innerJoin(words, eq(wordEditSuggestions.wordId, words.id))
      .where(and(...conditions))
      .orderBy(desc(wordEditSuggestions.id))
      .limit(limit + 1);

    const slice = rows.slice(0, limit);
    const items = slice.map((s) => ({
      id: s.id,
      wordId: s.wordId,
      wordLemma: s.lemma,
      status: s.status as SuggestionStatus,
      createdAt: s.createdAt,
      reviewComment: s.reviewComment,
      reason: s.reason,
      reasonCode: (s.reasonCode ?? 'other') as SuggestionReasonCode,
      reviewedAt: s.reviewedAt,
    }));
    const hasMore = rows.length > limit;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async getSuggestionDetail(id: string): Promise<SuggestionDetail | null> {
    const [row] = await db
      .select({
        suggestion: wordEditSuggestions,
        lemma: words.lemma,
        username: users.username,
        displayName: users.displayName,
      })
      .from(wordEditSuggestions)
      .innerJoin(words, eq(wordEditSuggestions.wordId, words.id))
      .innerJoin(users, eq(wordEditSuggestions.userId, users.id))
      .where(and(eq(wordEditSuggestions.id, id), isNull(wordEditSuggestions.deletedAt)))
      .limit(1);
    if (!row) return null;

    const current = await getCurrentWordSnapshot(row.suggestion.wordId);
    if (!current) return null;

    const proposed = asProposed(row.suggestion.proposedChanges);
    const trimmed = row.displayName?.trim() || null;
    return {
      suggestion: {
        id: row.suggestion.id,
        userId: row.suggestion.userId,
        wordId: row.suggestion.wordId,
        proposedChanges: proposed,
        reason: row.suggestion.reason,
        reasonCode: (row.suggestion.reasonCode ?? 'other') as SuggestionReasonCode,
        status: row.suggestion.status as SuggestionStatus,
        reviewedBy: row.suggestion.reviewedBy,
        reviewedAt: row.suggestion.reviewedAt,
        reviewComment: row.suggestion.reviewComment,
        createdAt: row.suggestion.createdAt,
        updatedAt: row.suggestion.updatedAt,
        deletedAt: row.suggestion.deletedAt,
        deletedBy: row.suggestion.deletedBy,
        contributorUsername: row.username,
        contributorDisplayName: trimmed || row.username,
        wordLemma: row.lemma,
      },
      currentWord: current,
      diff: await buildDiff(proposed, current),
    };
  }

  async findById(id: string): Promise<WordEditSuggestion | null> {
    const [result] = await db
      .select()
      .from(wordEditSuggestions)
      .where(and(eq(wordEditSuggestions.id, id), isNull(wordEditSuggestions.deletedAt)))
      .limit(1);
    if (!result) return null;
    return {
      id: result.id,
      userId: result.userId,
      wordId: result.wordId,
      proposedChanges: asProposed(result.proposedChanges),
      reason: result.reason,
      reasonCode: (result.reasonCode ?? 'other') as SuggestionReasonCode,
      status: result.status as SuggestionStatus,
      reviewedBy: result.reviewedBy,
      reviewedAt: result.reviewedAt,
      reviewComment: result.reviewComment,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      deletedAt: result.deletedAt,
      deletedBy: result.deletedBy,
    };
  }

  async approveSuggestion(
    id: string,
    reviewerId: string,
    comment?: string,
    imageOpts?: {
      decisions?: { key: string; decision: 'approve' | 'reject' }[];
      censoredFiles?: Record<string, { bytes: Uint8Array; mimeType: string | null }>;
    },
  ): Promise<{
    applied: boolean;
    changesApplied: number;
    wordLemma: string;
    wordId: string;
    skippedDuplicates: { meaningId: string; definition: string; translationText: string }[];
  }> {
    const [row] = await db
      .select({
        wordId: wordEditSuggestions.wordId,
        status: wordEditSuggestions.status,
        baselineSnapshot: wordEditSuggestions.baselineSnapshot,
        proposedChanges: wordEditSuggestions.proposedChanges,
        proposerId: wordEditSuggestions.userId,
      })
      .from(wordEditSuggestions)
      .where(and(eq(wordEditSuggestions.id, id), isNull(wordEditSuggestions.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundError('SUGGESTION_NOT_FOUND', 'Usulan tidak ditemukan');
    if (row.status !== 'pending') {
      throw new ConflictError('SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah pernah diverifikasi');
    }
    if (row.baselineSnapshot) {
      await this.moderateAppliedStagingImages(
        row.wordId,
        asProposed(row.proposedChanges),
        imageOpts,
      );
      const [word] = await db
        .select({ lemma: words.lemma, isVerified: words.isVerified })
        .from(words)
        .where(eq(words.id, row.wordId))
        .limit(1);
      // Guard preserve (#86) + invariant trust-makna: jangan naikkan
      // words.is_verified tanpa makna verified. Makna published milik kata
      // diverifikasi reviewer (usulan diterima = reviewer memeriksa isinya),
      // lalu word mengikuti rollup makna.
      const now = new Date();
      await db
        .update(meanings)
        .set({
          isVerified: true,
          verifiedBy: reviewerId,
          verifiedAt: now,
          needsReview: false,
          updatedBy: reviewerId,
          updatedAt: now,
        })
        .where(
          and(
            eq(meanings.wordId, row.wordId),
            eq(meanings.status, 'published'),
            eq(meanings.isVerified, false),
            isNull(meanings.deletedAt),
          ),
        );
      await rollupWordVerifiedFromMeaningsDb(row.wordId);
      // Event feed: pengusul (usulannya diterima) + verifikator.
      await this.emitEvent({
        kind: 'suggestion_applied',
        actorId: row.proposerId ?? undefined,
        targetWordId: row.wordId,
        targetId: id,
        dedupeKey: `suggestion:${id}`,
      });
      // #56: usulan edit diterima → verifikasi menyebut pengusulnya.
      const proposedByName = row.proposerId
        ? row.proposerId !== reviewerId
          ? await this.displayNameOf(row.proposerId)
          : null
        : null;
      await this.emitEvent({
        kind: 'word_verified',
        actorId: reviewerId,
        targetWordId: row.wordId,
        targetId: row.wordId,
        dedupeKey: `word_verified:${row.wordId}`,
        ...(proposedByName ? { proposedByName } : {}),
      });
      await db
        .update(wordEditSuggestions)
        .set({
          status: 'approved',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewComment: comment ?? null,
          updatedAt: new Date(),
        })
        .where(eq(wordEditSuggestions.id, id));
      return {
        applied: false,
        changesApplied: 0,
        wordLemma: word?.lemma ?? '',
        wordId: row.wordId,
        skippedDuplicates: [],
      };
    }

    const prepared = await prepareProposedImagesForApprove(asProposed(row.proposedChanges), {
      publicImageStorage: this.publicImageStorage,
      imageStorage: this.imageStorage,
      decisions: imageOpts?.decisions,
      censoredFiles: imageOpts?.censoredFiles,
    });
    const result = await applyChangesToWord(id, reviewerId, 'approve', comment, prepared);
    // Kata baru dari lemma target belum ada: masuk feed sebagai word_created
    // (approve = momen kata jadi published).
    for (const created of result.createdWords) {
      await this.emitEvent({
        kind: 'word_created',
        actorId: row.proposerId ?? reviewerId,
        targetWordId: created.id,
        targetId: created.id,
        dedupeKey: `word:${created.id}`,
      });
    }
    // Event feed: usulan diterima (pengusul) + verifikasi kata (reviewer).
    await this.emitEvent({
      kind: 'suggestion_applied',
      actorId: row.proposerId ?? undefined,
      targetWordId: row.wordId,
      targetId: id,
      dedupeKey: `suggestion:${id}`,
    });
    // #56: verifikasi menyebut pengusul (copy "Memverifikasi usulan B: ...").
    const proposedByName = row.proposerId
      ? row.proposerId !== reviewerId
        ? await this.displayNameOf(row.proposerId)
        : null
      : null;
    await this.emitEvent({
      kind: 'word_verified',
      actorId: reviewerId,
      targetWordId: row.wordId,
      targetId: row.wordId,
      dedupeKey: `word_verified:${row.wordId}`,
      ...(proposedByName ? { proposedByName } : {}),
    });
    return result;
  }

  async rejectSuggestion(id: string, reviewerId: string, comment: string): Promise<boolean> {
    if (!comment.trim()) {
      throw new BadRequestError('VALIDATION_ERROR', 'Alasan penolakan wajib diisi', [
        { field: 'comment', message: 'Alasan penolakan wajib diisi' },
      ]);
    }
    const [current] = await db
      .select({
        wordId: wordEditSuggestions.wordId,
        baselineSnapshot: wordEditSuggestions.baselineSnapshot,
        proposedChanges: wordEditSuggestions.proposedChanges,
      })
      .from(wordEditSuggestions)
      .where(
        and(
          eq(wordEditSuggestions.id, id),
          eq(wordEditSuggestions.status, 'pending'),
          isNull(wordEditSuggestions.deletedAt),
        ),
      )
      .limit(1);
    if (!current) {
      const existing = await this.findById(id);
      if (!existing) throw new NotFoundError('SUGGESTION_NOT_FOUND', 'Usulan tidak ditemukan');
      throw new BadRequestError('SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah pernah diverifikasi');
    }

    const proposed = asProposed(current.proposedChanges);
    await deleteProposedStagingImages(proposed, this.imageStorage);
    if (current.baselineSnapshot) {
      await restoreBaseline(current.wordId, current.baselineSnapshot, proposed);
      await this.softDeleteAppliedStagingImages(current.wordId, proposed);
    }

    const [updated] = await db
      .update(wordEditSuggestions)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wordEditSuggestions.id, id),
          eq(wordEditSuggestions.status, 'pending'),
          isNull(wordEditSuggestions.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      throw new BadRequestError('SUGGESTION_ALREADY_REVIEWED', 'Usulan sudah pernah diverifikasi');
    }

    await db.insert(auditLogs).values({
      userId: reviewerId,
      action: 'suggest_edit_rejected',
      entityType: 'word',
      entityId: updated.wordId,
      oldData: null,
      newData: { status: 'rejected', comment },
      requestId: null,
      sourceContributionId: id,
    });

    // Sembunyikan event "mengusulkan perubahan" dari feed: usulan ditolak
    // = bukan lagi aksi publik (konsisten hide vote retract, AGENTS.md #25).
    await this.emitEvent({
      kind: 'suggestion_created',
      actorId: updated.userId,
      targetWordId: updated.wordId,
      targetId: id,
      hidden: true,
      dedupeKey: `suggestion:${id}`,
    });

    return true;
  }

  async correctSuggestion(
    id: string,
    reviewerId: string,
    correctedChanges: ProposedChanges,
    publish: boolean,
    comment?: string,
    imageOpts?: {
      decisions?: { key: string; decision: 'approve' | 'reject' }[];
      censoredFiles?: Record<string, { bytes: Uint8Array; mimeType: string | null }>;
    },
  ): Promise<{
    applied: boolean;
    changesApplied: number;
    status: SuggestionStatus;
    wordLemma: string;
  }> {
    const validation = verifyProposedChanges(correctedChanges);
    if (!validation.valid) {
      throw new BadRequestError(
        'INVALID_SUGGESTION_CHANGES',
        'Perubahan tidak valid',
        validation.errors.map((e) => ({ field: e.field, message: e.message })),
      );
    }

    if (publish) {
      const prepared = await prepareProposedImagesForApprove(correctedChanges, {
        publicImageStorage: this.publicImageStorage,
        imageStorage: this.imageStorage,
        decisions: imageOpts?.decisions,
        censoredFiles: imageOpts?.censoredFiles,
      });
      const result = await applyChangesToWord(
        id,
        reviewerId,
        'correct_and_publish',
        comment,
        prepared,
      );
      return {
        applied: result.applied,
        changesApplied: result.changesApplied,
        status: 'corrected',
        wordLemma: result.wordLemma,
      };
    }

    const [updated] = await db
      .update(wordEditSuggestions)
      .set({
        proposedChanges: correctedChanges as unknown as Record<string, unknown>,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(wordEditSuggestions.id, id), isNull(wordEditSuggestions.deletedAt)))
      .returning();
    if (!updated) throw new NotFoundError('SUGGESTION_NOT_FOUND', 'Usulan tidak ditemukan');

    const [word] = await db
      .select({ lemma: words.lemma })
      .from(words)
      .where(eq(words.id, updated.wordId))
      .limit(1);

    return {
      applied: false,
      changesApplied: 0,
      status: 'pending',
      wordLemma: word?.lemma ?? '',
    };
  }

  /**
   * Usulan sudah apply_pending: foto ImageKit ada di word_images (isVerified=false).
   * Promote yang ditayangkan; soft-delete + hapus staging yang ditolak.
   */
  private async moderateAppliedStagingImages(
    wordId: string,
    changes: ProposedChanges,
    imageOpts?: {
      decisions?: { key: string; decision: 'approve' | 'reject' }[];
      censoredFiles?: Record<string, { bytes: Uint8Array; mimeType: string | null }>;
    },
  ): Promise<void> {
    const decisionByKey = new Map(
      (imageOpts?.decisions ?? []).map((d) => [d.key, d.decision] as const),
    );
    let addIndex = 0;

    for (const img of changes.images ?? []) {
      if (img.action !== 'add' || img.provider !== 'imagekit' || !img.providerFileId || !img.url) {
        if (img.action === 'add') addIndex += 1;
        continue;
      }

      const indexKey = String(addIndex);
      const fileKey = img.providerFileId;
      addIndex += 1;

      const decision =
        decisionByKey.get(indexKey) ??
        decisionByKey.get(fileKey) ??
        'approve';

      const [row] = await db
        .select({
          id: wordImages.id,
          url: wordImages.url,
          provider: wordImages.provider,
          providerFileId: wordImages.providerFileId,
        })
        .from(wordImages)
        .where(
          and(
            eq(wordImages.wordId, wordId),
            eq(wordImages.providerFileId, img.providerFileId),
            eq(wordImages.provider, 'imagekit'),
            isNull(wordImages.deletedAt),
          ),
        )
        .limit(1);
      if (!row) continue;

      const staging = {
        id: row.id,
        url: row.url,
        provider: row.provider,
        providerFileId: row.providerFileId,
      };

      if (decision === 'reject') {
        await deleteStagingWordImage(staging, this.imageStorage);
        await db
          .update(wordImages)
          .set({ deletedAt: new Date(), isPrimary: false, isVerified: false })
          .where(eq(wordImages.id, row.id));
        continue;
      }

      const censored =
        imageOpts?.censoredFiles?.[indexKey] ?? imageOpts?.censoredFiles?.[fileKey];
      const promoted = await promoteWordImageFromStaging(staging, this.publicImageStorage, {
        bytes: censored?.bytes,
        mimeType: censored?.mimeType,
      });
      await db
        .update(wordImages)
        .set({
          url: promoted.url,
          provider: promoted.provider,
          providerFileId: promoted.providerFileId,
          sha: promoted.sha,
          isVerified: true,
          status: 'published',
        })
        .where(eq(wordImages.id, row.id));
      await deleteStagingWordImage(staging, this.imageStorage);
    }
  }

  /** Soft-delete baris staging ImageKit yang sudah terpasang lewat apply_pending. */
  private async softDeleteAppliedStagingImages(
    wordId: string,
    changes: ProposedChanges,
  ): Promise<void> {
    const fileIds = (changes.images ?? [])
      .filter((i) => i.action === 'add' && i.provider === 'imagekit' && i.providerFileId)
      .map((i) => i.providerFileId!);
    if (fileIds.length === 0) return;

    await db
      .update(wordImages)
      .set({ deletedAt: new Date(), isPrimary: false, isVerified: false })
      .where(
        and(
          eq(wordImages.wordId, wordId),
          eq(wordImages.provider, 'imagekit'),
          inArray(wordImages.providerFileId, fileIds),
          isNull(wordImages.deletedAt),
        ),
      );
  }

  async getChangeHistory(
    wordId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: ChangeHistoryItem[]; nextCursor: string | null; hasMore: boolean }> {
    const [word] = await db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)))
      .limit(1);
    if (!word) throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');

    const conditions = [eq(auditLogs.entityType, 'word'), eq(auditLogs.entityId, wordId)];
    if (cursor) conditions.push(lt(auditLogs.id, cursor));

    const rows = await db
      .select({
        auditId: auditLogs.id,
        auditUserId: auditLogs.userId,
        action: auditLogs.action,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        createdAt: auditLogs.createdAt,
        sourceContributionId: auditLogs.sourceContributionId,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(Math.min(limit + 1, 101));

    if (rows.length === 0) return { items: [], nextCursor: null, hasMore: false };

    const userIds = [
      ...new Set(rows.filter((r) => r.auditUserId).map((r) => r.auditUserId as string)),
    ];
    const sourceIds = [
      ...new Set(
        rows.filter((r) => r.sourceContributionId).map((r) => r.sourceContributionId as string),
      ),
    ];

    const suggestionMap: Record<
      string,
      { userId: string; reason: string; reviewedBy: string | null; reviewComment: string | null }
    > = {};
    if (sourceIds.length > 0) {
      const sugRows = await db
        .select({
          id: wordEditSuggestions.id,
          userId: wordEditSuggestions.userId,
          reason: wordEditSuggestions.reason,
          reviewedBy: wordEditSuggestions.reviewedBy,
          reviewComment: wordEditSuggestions.reviewComment,
        })
        .from(wordEditSuggestions)
        .where(inArray(wordEditSuggestions.id, sourceIds));
      for (const s of sugRows) {
        suggestionMap[s.id] = {
          userId: s.userId,
          reason: s.reason,
          reviewedBy: s.reviewedBy,
          reviewComment: s.reviewComment,
        };
        userIds.push(s.userId);
        if (s.reviewedBy) userIds.push(s.reviewedBy);
      }
    }

    const labelMap = await getUserPublicLabels([...new Set(userIds)]);

    const mapped: ChangeHistoryItem[] = rows.map((r) => {
      const type: ChangeHistoryItem['type'] =
        r.action === 'duplicate_vote'
          ? 'duplicate_vote'
          : r.sourceContributionId
            ? 'suggest_edit'
            : 'direct_edit';
      const changes =
        r.action === 'duplicate_vote'
          ? this._extractDuplicateVoteChanges(r.newData)
          : this._extractChanges(r.oldData, r.newData);
      let source: SuggestionSource | null = null;
      if (r.sourceContributionId && suggestionMap[r.sourceContributionId]) {
        const sug = suggestionMap[r.sourceContributionId];
        const suggested = labelMap[sug.userId];
        const reviewer = sug.reviewedBy ? labelMap[sug.reviewedBy] : undefined;
        source = {
          suggestionId: r.sourceContributionId,
          suggestedByUserId: sug.userId,
          suggestedByUsername: suggested?.username ?? '',
          suggestedByDisplayName: suggested?.displayName ?? suggested?.username ?? '',
          reason: sug.reason,
          reviewerUserId: sug.reviewedBy,
          reviewerUsername: sug.reviewedBy ? (reviewer?.username ?? null) : null,
          reviewerDisplayName: sug.reviewedBy
            ? (reviewer?.displayName ?? reviewer?.username ?? null)
            : null,
          reviewComment: sug.reviewComment,
        };
      }
      const actor = r.auditUserId ? labelMap[r.auditUserId] : undefined;
      return {
        id: r.auditId,
        timestamp: r.createdAt,
        actorUserId: r.auditUserId ?? '',
        actorUsername: actor?.username ?? null,
        actorDisplayName: actor?.displayName ?? actor?.username ?? null,
        type,
        changes,
        source,
      };
    });

    const hasMore = mapped.length > limit;
    const items = mapped.slice(0, limit);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  private _extractDuplicateVoteChanges(newData: unknown): ChangeHistoryItem['changes'] {
    const n = (newData ?? {}) as Record<string, unknown>;
    const value = n.value === -1 || n.value === '-1' ? -1 : 1;
    const arah = value === 1 ? 'Mendukung' : 'Tidak mendukung';
    const definition = typeof n.definition === 'string' ? n.definition : '-';
    const translation =
      typeof n.translation_text === 'string' ? n.translation_text : '-';
    return [
      {
        entity: 'meaning',
        field: 'duplicate_vote',
        oldValue: null,
        newValue: value,
        displayOld: '-',
        displayNew: arah,
      },
      {
        entity: 'meaning',
        field: 'definition',
        oldValue: null,
        newValue: definition,
        displayOld: '-',
        displayNew: definition,
      },
      {
        entity: 'meaning',
        field: 'translation_text',
        oldValue: null,
        newValue: translation,
        displayOld: '-',
        displayNew: translation,
      },
    ];
  }

  private _extractChanges(oldData: unknown, newData: unknown): ChangeHistoryItem['changes'] {
    if (!oldData && !newData) return [];
    const oObj = (oldData ?? {}) as Record<string, unknown>;
    const nObj = (newData ?? {}) as Record<string, unknown>;
    const changes: ChangeHistoryItem['changes'] = [];
    const allKeys = new Set([...Object.keys(oObj), ...Object.keys(nObj)]);
    for (const key of allKeys) {
      const o = oObj[key] ?? null;
      const n = nObj[key] ?? null;
      if (JSON.stringify(o) !== JSON.stringify(n)) {
        changes.push({
          entity: 'word',
          field: key,
          oldValue: o,
          newValue: n,
          displayOld: this._display(o),
          displayNew: this._display(n),
        });
      }
    }
    return changes;
  }

  private _display(val: unknown): string {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (typeof obj.lemma === 'string') return obj.lemma;
      if (typeof obj.translation_text === 'string') return obj.translation_text;
      if (typeof obj.definition === 'string') return obj.definition;
      return JSON.stringify(val);
    }
    return String(val);
  }
}
/**
 * Rollup words.is_verified dari makna published - cermin logika
 * WordRepositoryImpl.rollupWordVerifiedFromMeanings (word verified iff
 * SEMUA makna published verified; tanpa makna published = false).
 * Dipakai approveSuggestion; jangan naikkan word tanpa makna verified.
 */
async function rollupWordVerifiedFromMeaningsDb(wordId: string): Promise<void> {
  const rows = await db
    .select({
      isVerified: meanings.isVerified,
      verifiedBy: meanings.verifiedBy,
      verifiedAt: meanings.verifiedAt,
    })
    .from(meanings)
    .where(
      and(
        eq(meanings.wordId, wordId),
        eq(meanings.status, 'published'),
        isNull(meanings.deletedAt),
      ),
    );
  if (rows.length === 0) {
    await db
      .update(words)
      .set({ isVerified: false, verifiedBy: null, verifiedAt: null })
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)));
    return;
  }
  if (!rows.every((r) => r.isVerified === true)) {
    await db
      .update(words)
      .set({ isVerified: false, verifiedBy: null, verifiedAt: null })
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)));
    return;
  }
  let best = rows[0]!;
  for (const r of rows) {
    const a = best.verifiedAt?.getTime() ?? 0;
    const b = r.verifiedAt?.getTime() ?? 0;
    if (b >= a) best = r;
  }
  await db
    .update(words)
    .set({
      isVerified: true,
      verifiedBy: best.verifiedBy,
      verifiedAt: best.verifiedAt ?? new Date(),
    })
    .where(and(eq(words.id, wordId), isNull(words.deletedAt)));
}
