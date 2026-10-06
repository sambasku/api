import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { activityEvents, searchMisses, users, votes, words } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { PublicActivityItem } from '@/modules/user/domain/entities/public-profile.entity';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { ActivityItem, ActivityKind } from '../domain/entities/activity-item.entity';
import type { ActivityEventKind } from '../domain/entities/activity-event.entity';
import type { ActivityCursor } from '../domain/merge-activity';

/**
 * Baca feed dari `activity_events` (write-through log) - pengganti agregasi
 * 11 query sumber. Event dibekukan saat kejadian; hanya visibility yang dicek
 * read-time.
 *
 * Visibility read-time per event:
 * - hidden_at is null (event tidak dicabut);
 * - bila target_word_id terisi: kata masih published, tidak soft-delete, tidak
 *   berlabel terlarang (join words);
 * - aktor: akun terhapus tetap tampil sebagai label "Akun tidak ditemukan"
 *   (karya tidak ikut hilang), avatar dikosongkan;
 * - excludeUserId: buang event milik viewer sendiri.
 */

const KIND_TO_WIRE: Record<ActivityEventKind, ActivityKind> = {
  word_created: 'word',
  word_verified: 'vote' as ActivityKind, // wire lama tak punya 'verification'; dikoreksi di bawah
  contribution_image: 'word_image',
  contribution_audio: 'word_audio',
  contribution_pron: 'pronunciation',
  contribution_example: 'example',
  comment_created: 'comment',
  vote_word: 'vote',
  vote_comment: 'vote',
  discussion_created: 'discussion',
  suggestion_applied: 'suggestion',
  suggestion_selfapply: 'suggestion',
  suggestion_created: 'suggestion',
  contribution_submitted: 'contribution',
  search_miss: 'search_miss',
  user_joined: 'welcome',
  card_shared: 'card_share',
};

/** Label aksi per kind (badan feed; lemma diresolve terpisah). */
const KIND_BODY: Record<ActivityEventKind, string> = {
  word_created: '',
  word_verified: 'Memverifikasi kata',
  contribution_image: 'Menambah foto',
  contribution_audio: 'Merekam suara',
  contribution_pron: 'Menambah cara baca',
  contribution_example: 'Menambah contoh kalimat',
  comment_created: '',
  vote_word: '',
  vote_comment: '',
  discussion_created: '',
  suggestion_applied: 'Mengusulkan perubahan',
  suggestion_selfapply: 'Melengkapi kata',
  suggestion_created: 'Mengusulkan perubahan',
  contribution_submitted: 'Mengusulkan kata baru',
  search_miss: '',
  user_joined: 'Bergabung di SambasKu',
  card_shared: 'Membagikan kartu',
};

function quoted(s: string): string {
  return `"${s}"`;
}

/**
 * Cursor profil = id event (ULID). ULID monoton naik dengan waktu, jadi
 * id-desc == occurred_at-desc; keyset tuple (waktu, id) tetap benar dengan
 * waktu yang didekode dari 10 karakter pertama ULID (Crockford base32).
 */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function cursorFromEventId(id: string): { id: string; createdAt: Date } {
  let ms = 0;
  for (const c of id.slice(0, 10)) {
    const v = ULID_ALPHABET.indexOf(c);
    if (v < 0) return { id, createdAt: new Date(0) };
    ms = ms * 32 + v;
  }
  return { id, createdAt: new Date(ms) };
}

export class ActivityEventFeedRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  /** Halaman feed beranda (semua kind). Keyset (occurred_at, id) desc. */
  async listFeed(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
  ): Promise<ActivityItem[]> {
    const rows = await this.selectVisible(limit, before, excludeUserId);
    return this.buildItems(rows);
  }

  /** Halaman timeline profil publik (event actor tertentu). */
  async listByActor(
    actorId: string,
    limit: number,
    before?: ActivityCursor,
  ): Promise<ActivityItem[]> {
    const rows = await this.selectVisible(limit, before, undefined, actorId);
    return this.buildItems(rows);
  }

  /**
   * Timeline profil publik dalam bentuk PublicActivityItem (19-api-profil-publik).
   * Kategori profil dipetakan dari kind event:
   * - contribution: contribution_* + word_created + suggestion_applied (pengusul)
   * - comment: comment_created
   * - verification: word_verified + suggestion_selfapply
   * - vote: vote_*
   * Cursor = id event (ULID monoton turun) - kontrak lama pakai id sumber,
   * keduanya opaque bagi klien.
   */
  async listPublicByActor(
    actorId: string,
    category: 'contribution' | 'comment' | 'verification' | 'vote',
    limit: number,
    cursor?: string,
  ): Promise<{ items: PublicActivityItem[]; nextCursor: string | null; hasMore: boolean }> {
    const kindSets: Record<typeof category, ActivityEventKind[]> = {
      contribution: [
        'word_created',
        'contribution_image',
        'contribution_audio',
        'contribution_pron',
        'contribution_example',
        'suggestion_applied',
        'suggestion_created',
        'contribution_submitted',
      ],
      comment: ['comment_created'],
      verification: ['word_verified', 'suggestion_selfapply'],
      vote: ['vote_word', 'vote_comment'],
    };
    const rows = await this.selectVisible(
      limit + 1,
      cursor ? cursorFromEventId(cursor) : undefined,
      undefined,
      actorId,
      kindSets[category],
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: PublicActivityItem[] = [];
    for (const row of page) {
      const kind = row.kind as ActivityEventKind;
      const word = row.targetWordId ? await this.resolveWord(row.targetWordId) : null;
      const lemma = word?.lemma ?? null;
      // Arah vote dibaca read-time dari tabel votes (mobile membaca arah
      // dari akhiran summary, kontrak feed lama). targetId event = entityId
      // target (wordId / commentId), bukan id baris votes.
      let voteValue: number | null = null;
      if ((kind === 'vote_word' || kind === 'vote_comment') && row.targetId) {
        const [v] = await this.db
          .select({ value: votes.value })
          .from(votes)
          .where(
            and(
              eq(votes.userId, actorId),
              eq(votes.entityType, kind === 'vote_word' ? 'word' : 'comment'),
              eq(votes.entityId, row.targetId),
            ),
          )
          .limit(1);
        voteValue = v?.value ?? null;
      }
      items.push({
        id: row.id,
        kind: category,
        occurredAt: row.occurredAt,
        wordId: word?.id ?? null,
        lemma,
        summary: this.publicSummary(kind, lemma, row.targetId, voteValue),
      });
    }
    return {
      items,
      nextCursor: hasMore && page[page.length - 1] ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /** Wording timeline profil: aksi berimbuhan tanpa subjek (docs 23/19). */
  private publicSummary(
    kind: ActivityEventKind,
    lemma: string | null,
    targetId: string | null,
    voteValue: number | null = null,
  ): string {
    const q = lemma ? `"${lemma}"` : '';
    switch (kind) {
      case 'word_created':
        return `Menambahkan kata ${q}`.trim();
      case 'contribution_image':
        return `Menambahkan foto ${q}`.trim();
      case 'contribution_audio':
        return `Menambahkan rekaman suara ${q}`.trim();
      case 'contribution_pron':
        return `Menambahkan cara baca ${q}`.trim();
      case 'contribution_example':
        return `Menambahkan contoh kalimat ${q}`.trim();
      case 'suggestion_applied':
        return `Usulan perubahan diterima ${q}`.trim();
      case 'suggestion_selfapply':
        return `Melengkapi kata ${q}`.trim();
      case 'suggestion_created':
        return `Mengusulkan perubahan ${q}`.trim();
      case 'contribution_submitted':
        return `Mengusulkan kata baru ${q}`.trim();
      case 'comment_created':
        return targetId ? `Mengomentari kata ${q}`.trim() : 'Mengomentari';
      case 'word_verified':
        return `Memverifikasi kata ${q}`.trim();
      case 'vote_word':
      case 'vote_comment':
        // Kontrak feed lama: akhiran summary = arah vote (mobile parse ini).
        return voteValue === null || voteValue >= 0
          ? `${q} sudah pas`.trim()
          : `${q} perlu dicek ulang`.trim();
      default:
        return lemma ?? '';
    }
  }

  // ---------------------------------------------------------------- select --

  private feedSafeWordSql(): SQL | undefined {
    return sql`(
      ${words.deletedAt} is null
      and ${words.status} = 'published'
      and ${sql.join(
        FEED_EXCLUDED_USAGE_LABELS.map(
          (label) => sql`${words.usageLabels} NOT LIKE ${`%\"${label}\"%`}`,
        ),
        sql` and `,
      )}
    )`;
  }

  private baseConditions(excludeUserId?: string, actorId?: string): SQL[] {
    const conds: SQL[] = [sql`${activityEvents.hiddenAt} is null`];
    if (excludeUserId) {
      conds.push(sql`(${activityEvents.actorId} is null or ${activityEvents.actorId} <> ${excludeUserId})`);
    }
    if (actorId) {
      conds.push(sql`${activityEvents.actorId} = ${actorId}`);
    }
    return conds;
  }

  private async selectVisible(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
    actorId?: string,
    kinds?: ActivityEventKind[],
  ) {
    const occurredAt = activityEvents.occurredAt;
    const conds = this.baseConditions(excludeUserId, actorId);
    if (kinds && kinds.length > 0) {
      conds.push(inArray(activityEvents.kind, kinds));
    }

    if (before) {
      const beforeSeconds = Math.floor(before.createdAt.getTime() / 1000);
      const colon = before.id.indexOf(':');
      const entityId = colon >= 0 ? before.id.slice(colon + 1) : before.id;
      // Keyset tuple (occurred_at, id). Id event ULID monoton: detik sama ->
      // tiebreak id tetap benar (profil cursor = ULID polos, wire = kind:ulid).
      conds.push(
        sql`(${occurredAt}, ${activityEvents.id}) < (${beforeSeconds}, ${entityId})`,
      );
    }

    const rows = await this.db
      .select({
        id: activityEvents.id,
        kind: activityEvents.kind,
        actorId: activityEvents.actorId,
        targetWordId: activityEvents.targetWordId,
        targetId: activityEvents.targetId,
        occurredAt: activityEvents.occurredAt,
      })
      .from(activityEvents)
      .leftJoin(
        words,
        and(
          eq(words.id, activityEvents.targetWordId),
          // hanya kata layak-tayang yang lolos; event tanpa kata ikut (left join)
          sql`${this.feedSafeWordSql()}`,
      ))
      .where(
        and(
          ...conds,
          // event yang menyebut kata harus lolos visibility kata;
          // event tanpa kata (welcome, search_miss tanpa word) tetap masuk.
          sql`(${activityEvents.targetWordId} is null or ${words.id} is not null)`,
        ),
      )
      .orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id))
      .limit(limit);
    return rows;
  }

  // ----------------------------------------------------------------- build --

  private async buildItems(rows: Array<{
    id: string;
    kind: string;
    actorId: string | null;
    targetWordId: string | null;
    targetId: string | null;
    occurredAt: Date;
  }>): Promise<ActivityItem[]> {
    const out: ActivityItem[] = [];
    for (const row of rows) {
      const item = await this.buildItem(row);
      if (item) out.push(item);
    }
    return out;
  }

  private async buildItem(row: {
    id: string;
    kind: string;
    actorId: string | null;
    targetWordId: string | null;
    targetId: string | null;
    occurredAt: Date;
  }): Promise<ActivityItem | null> {
    const kind = row.kind as ActivityEventKind;
    const actor = await this.resolveActor(row.actorId);
    const word = row.targetWordId ? await this.resolveWord(row.targetWordId) : null;
    let lemma = word?.lemma ?? null;

    // search_miss: lemma tidak ada; body pakai term aslinya.
    if (kind === 'search_miss' && row.targetId) {
      const [miss] = await this.db
        .select({ term: searchMisses.term })
        .from(searchMisses)
        .where(eq(searchMisses.id, row.targetId))
        .limit(1);
      lemma = miss?.term ?? null;
    }

    const body = this.bodyFor(kind, lemma);
    const subtitle = this.subtitleFor(kind, lemma);
    const target = this.targetFor(kind, row, word);
    const wire = KIND_TO_WIRE[kind];

    return {
      id: `${wire}:${row.id}`,
      kind: wire as ActivityKind,
      createdAt: row.occurredAt,
      actor,
      body,
      subtitle,
      target,
    };
  }

  private async resolveActor(actorId: string | null) {
    if (!actorId) return null;
    const [u] = await this.db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        deletedAt: users.deletedAt,
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1);
    if (!u) return null;
    const username = publicAccountName(u.username, u.deletedAt);
    const displayName = publicAccountDisplayName(u.displayName, u.username, u.deletedAt);
    // Akun terhapus: karya tetap tayang berlabel, tapi tidak bisa dibuka profilnya.
    const hidden = !!u.deletedAt || u.id === ANONIM_USER_ID;
    return {
      username: hidden ? null : username,
      displayName: username || displayName ? displayName ?? DELETED_LABEL : null,
      avatarUrl: u.deletedAt ? null : (u.avatarUrl ?? null),
    };
  }

  private async resolveWord(wordId: string) {
    const [w] = await this.db
      .select({ id: words.id, lemma: words.lemma })
      .from(words)
      .where(eq(words.id, wordId))
      .limit(1);
    return w ?? null;
  }

  private bodyFor(kind: ActivityEventKind, lemma: string | null): string {
    switch (kind) {
      case 'word_created':
        return lemma ? quoted(lemma) : '';
      case 'word_verified':
        return lemma ? `Memverifikasi kata · ${quoted(lemma)}` : 'Memverifikasi kata';
      case 'suggestion_applied':
        return lemma ? `Mengusulkan perubahan · ${quoted(lemma)}` : 'Mengusulkan perubahan';
      case 'suggestion_selfapply':
        return lemma ? `Melengkapi kata · ${quoted(lemma)}` : 'Melengkapi kata';
      case 'card_shared':
        return lemma ? `Membagikan kartu · ${quoted(lemma)}` : 'Membagikan kartu';
      case 'search_miss':
        return lemma ? `Mencari "${lemma}" - belum ada di kamus.` : 'Mencari - belum ada di kamus.';
      case 'user_joined':
        return 'Bergabung di SambasKu';
      case 'contribution_image':
      case 'contribution_audio':
      case 'contribution_pron':
      case 'contribution_example':
        return lemma ? `${KIND_BODY[kind]} · ${quoted(lemma)}` : KIND_BODY[kind];
      default:
        return KIND_BODY[kind] ?? '';
    }
  }

  private subtitleFor(kind: ActivityEventKind, lemma: string | null): string | null {
    switch (kind) {
      case 'word_created':
        return 'Baru ditambahkan';
      case 'word_verified':
      case 'suggestion_selfapply':
        return 'Verifikasi';
      case 'suggestion_created':
        return 'Usulan baru';
      case 'contribution_submitted':
        return 'Usulan kata baru';
      case 'user_joined':
        return 'Selamat datang';
      default:
        return lemma;
    }
  }

  private targetFor(
    kind: ActivityEventKind,
    row: { targetId: string | null; targetWordId: string | null },
    word: { id: string; lemma: string } | null,
  ): ActivityItem['target'] {
    switch (kind) {
      case 'word_created':
      case 'word_verified':
      case 'contribution_image':
      case 'contribution_audio':
      case 'contribution_pron':
      case 'contribution_example':
      case 'suggestion_applied':
      case 'suggestion_selfapply':
      case 'suggestion_created':
      case 'contribution_submitted':
      case 'card_shared':
      case 'vote_word':
        return word ? { type: 'word', id: word.id } : null;
      case 'comment_created':
        return row.targetId ? { type: 'word', id: row.targetId! } : null;
      case 'vote_comment':
        return row.targetWordId ? { type: 'word', id: row.targetWordId! } : null;
      case 'discussion_created':
        return row.targetId ? { type: 'discussion', id: row.targetId! } : null;
      case 'search_miss':
        return row.targetId ? { type: 'search_miss', id: row.targetId! } : null;
      case 'user_joined':
        return row.targetId ? { type: 'user', id: row.targetId! } : null;
      default:
        return null;
    }
  }
}

const DELETED_LABEL = 'Akun tidak ditemukan';
