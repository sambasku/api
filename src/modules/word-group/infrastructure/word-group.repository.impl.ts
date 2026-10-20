import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  wordGroupMembers,
  wordGroups,
  words,
} from '@/shared/database/drizzle/schema';
import { ilikeCompat } from '@/shared/database/drizzle/ilike-compat';
import { ConflictError } from '@/shared/errors/app-error';
import type {
  WordGroupRecord,
  WordGroupStatus,
} from '../domain/entities/word-group.entity';
import type {
  AddWordGroupMemberInput,
  CreateWordGroupInput,
  ListWordGroupsInput,
  ListWordGroupsResult,
  UpdateWordGroupInput,
  WordGroupRepository,
} from '../domain/repositories/word-group.repository';

export class WordGroupRepositoryImpl implements WordGroupRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateWordGroupInput): Promise<WordGroupRecord> {
    await this.db.insert(wordGroups).values({
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      isVerified: input.isVerified,
      createdBy: input.createdBy,
    });
    // Anggota awal kosong; id baris baru tidak di-return (ULID default) -
    // ambil balik via nama + creator terbaru (deterministik cukup untuk
    // respons create; ponytail: pakai .returning() saat Turso stabil).
    const [row] = await this.db
      .select({ id: wordGroups.id })
      .from(wordGroups)
      .where(and(eq(wordGroups.name, input.name), eq(wordGroups.createdBy, input.createdBy)))
      .orderBy(desc(wordGroups.createdAt))
      .limit(1);
    if (!row) throw new Error('Word group create gagal - row tidak ketemu');
    return {
      id: row.id,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      isVerified: input.isVerified,
      createdBy: input.createdBy,
      members: [],
      createdAt: new Date(),
      updatedAt: null,
    };
  }

  async update(input: UpdateWordGroupInput): Promise<WordGroupRecord | null> {
    await this.db
      .update(wordGroups)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(wordGroups.id, input.id), isNull(wordGroups.deletedAt)));
    return this.findById(input.id);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(wordGroups)
      .set({ deletedAt: now, deletedBy, updatedAt: now })
      .where(and(eq(wordGroups.id, id), isNull(wordGroups.deletedAt)))
      .returning({ id: wordGroups.id });
    if (rows.length === 0) return false;
    // Keanggotaan ikut disembunyikan (soft) - grup terhapus tidak melebar.
    await this.db
      .update(wordGroupMembers)
      .set({ deletedAt: now, deletedBy, updatedAt: now })
      .where(and(eq(wordGroupMembers.groupId, id), isNull(wordGroupMembers.deletedAt)));
    return true;
  }

  async findById(id: string): Promise<WordGroupRecord | null> {
    const [groupRow] = await this.db
      .select()
      .from(wordGroups)
      .where(and(eq(wordGroups.id, id), isNull(wordGroups.deletedAt)))
      .limit(1);
    if (!groupRow) return null;
    const memberRows = await this.db
      .select({
        id: wordGroupMembers.id,
        wordId: wordGroupMembers.wordId,
        notes: wordGroupMembers.notes,
        status: wordGroupMembers.status,
        createdAt: wordGroupMembers.createdAt,
        lemma: words.lemma,
      })
      .from(wordGroupMembers)
      .innerJoin(words, eq(words.id, wordGroupMembers.wordId))
      .where(
        and(
          eq(wordGroupMembers.groupId, id),
          isNull(wordGroupMembers.deletedAt),
          // Termasuk baris termasuk kata non-published: antrean admin
          // perlu melihatnya; filter tayang ada di read-path publik.
        ),
      )
      .orderBy(asc(words.lemma));
    return {
      id: groupRow.id,
      name: groupRow.name,
      description: groupRow.description,
      status: groupRow.status as WordGroupStatus,
      isVerified: groupRow.isVerified,
      createdBy: groupRow.createdBy,
      members: memberRows.map((m) => ({
        id: m.id,
        wordId: m.wordId,
        lemma: m.lemma,
        notes: m.notes,
        status: m.status as WordGroupStatus,
        createdAt: m.createdAt,
      })),
      createdAt: groupRow.createdAt,
      updatedAt: groupRow.updatedAt ?? null,
    };
  }

  async list(input: ListWordGroupsInput): Promise<ListWordGroupsResult> {
    // Group + semua anggota dalam 2 query (bukan per grup), lalu rakit
    // di memori - hemat subrequest (aturan JOIN-bukan-N-panggilan).
    const conds = [isNull(wordGroups.deletedAt)];
    if (input.publicOnly) conds.push(eq(wordGroups.status, 'published'));
    else if (input.status) conds.push(eq(wordGroups.status, input.status));
    if (input.q?.trim()) {
      const q = `%${input.q.trim()}%`;
      conds.push(or(ilikeCompat(wordGroups.name, q), ilikeCompat(wordGroups.description, q))!);
    }
    if (input.before) conds.push(lt(wordGroups.id, input.before));
    const groupRows = await this.db
      .select()
      .from(wordGroups)
      .where(and(...conds))
      .orderBy(desc(wordGroups.id))
      .limit(input.limit + 1);
    const hasMore = groupRows.length > input.limit;
    const page = hasMore ? groupRows.slice(0, input.limit) : groupRows;

    const ids = page.map((g) => g.id);
    const memberRows =
      ids.length === 0
        ? []
        : input.wordId
          ? await this.db
              .select({
                groupId: wordGroupMembers.groupId,
                id: wordGroupMembers.id,
                wordId: wordGroupMembers.wordId,
                notes: wordGroupMembers.notes,
                status: wordGroupMembers.status,
                createdAt: wordGroupMembers.createdAt,
                lemma: words.lemma,
              })
              .from(wordGroupMembers)
              .innerJoin(words, eq(words.id, wordGroupMembers.wordId))
              .where(
                and(
                  inArray(wordGroupMembers.groupId, ids),
                  isNull(wordGroupMembers.deletedAt),
                ),
              )
              .orderBy(asc(words.lemma))
          : [];
    // filter wordId: hanya grup yang memuat kata itu
    const filtered =
      input.wordId && memberRows.length > 0
        ? page.filter((g) => memberRows.some((m) => m.groupId === g.id && m.wordId === input.wordId))
        : page;

    const membersByGroup = new Map<string, typeof memberRows>();
    for (const m of memberRows) {
      const list = membersByGroup.get(m.groupId);
      if (list) list.push(m);
      else membersByGroup.set(m.groupId, [m]);
    }

    const items: WordGroupRecord[] = filtered.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      status: g.status as WordGroupStatus,
      isVerified: g.isVerified,
      createdBy: g.createdBy,
      members: (membersByGroup.get(g.id) ?? []).map((m) => ({
        id: m.id,
        wordId: m.wordId,
        lemma: m.lemma,
        notes: m.notes,
        status: m.status as WordGroupStatus,
        createdAt: m.createdAt,
      })),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt ?? null,
    }));
    return {
      items,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
    };
  }

  async addMember(input: AddWordGroupMemberInput): Promise<WordGroupRecord | null> {
    const [groupRow] = await this.db
      .select({ id: wordGroups.id })
      .from(wordGroups)
      .where(and(eq(wordGroups.id, input.groupId), isNull(wordGroups.deletedAt)))
      .limit(1);
    if (!groupRow) return null;
    try {
      await this.db.insert(wordGroupMembers).values({
        groupId: input.groupId,
        wordId: input.wordId,
        notes: input.notes ?? null,
        status: input.status,
        createdBy: input.createdBy,
      });
    } catch (e) {
      // Drizzle membungkus error SQLite: teks UNIQUE ada di cause berantai.
      const msgOf = (err: unknown, depth = 0): string =>
        err instanceof Error
          ? err.message + (depth < 3 && err.cause ? ` ${msgOf(err.cause, depth + 1)}` : '')
          : String(err);
      const msg = msgOf(e);
      if (msg.includes('UNIQUE') || msg.includes('unique')) {
        throw new ConflictError(
          'WORD_GROUP_MEMBER_CONFLICT',
          'Kata ini sudah jadi anggota kelompok tersebut',
        );
      }
      throw e;
    }
    return this.findById(input.groupId);
  }

  async removeMember(groupId: string, wordId: string, deletedBy: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(wordGroupMembers)
      .set({ deletedAt: now, deletedBy, updatedAt: now })
      .where(
        and(
          eq(wordGroupMembers.groupId, groupId),
          eq(wordGroupMembers.wordId, wordId),
          isNull(wordGroupMembers.deletedAt),
        ),
      )
      .returning({ id: wordGroupMembers.id });
    return rows.length > 0;
  }

  async wordExists(wordId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ n: sql<number>`1` })
      .from(words)
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)))
      .limit(1);
    return !!row;
  }
}
