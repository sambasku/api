import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { activityEvents, places, searchMisses, users, votes, words } from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type { PublicActivityItem } from '@/modules/user/domain/entities/public-profile.entity';
import { FEED_EXCLUDED_USAGE_LABELS } from '@/shared/constants/usage-labels';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { ActivityItem, ActivityKind } from '../domain/entities/activity-item.entity';
import type { ActivityEventKind } from '../domain/entities/activity-event.entity';
import { FEED_CATEGORY_KINDS, type ActivityCursor } from '../domain/merge-activity';

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
  word_verified: 'verification', // #99: verifikasi dibedakan dari vote di wire
  contribution_image: 'word_image',
  contribution_audio: 'word_audio',
  contribution_pron: 'pronunciation',
  contribution_example: 'example',
  place_photo_added: 'place_photo',
  comment_created: 'comment',
vote_word: 'vote',
vote_comment: 'vote',
vote_meaning: 'vote',
  discussion_created: 'discussion',
  suggestion_applied: 'suggestion',
  suggestion_selfapply: 'suggestion',
  suggestion_created: 'suggestion',
  contribution_submitted: 'contribution',
  search_miss: 'search_miss',
  user_joined: 'welcome',
  card_shared: 'card_share',
  announcement: 'announcement',
};

/** Label aksi per kind (badan feed; lemma diresolve terpisah). */
const KIND_BODY: Record<ActivityEventKind, string> = {
  word_created: '',
  word_verified: 'Memverifikasi kata',
  contribution_image: 'Menambah foto',
  contribution_audio: 'Merekam suara',
  contribution_pron: 'Menambah cara baca',
  contribution_example: 'Menambah contoh kalimat',
  place_photo_added: 'Menambah foto wisata',
  comment_created: '',
  vote_word: '',
  vote_comment: '',
  vote_meaning: '',
  discussion_created: '',
  suggestion_applied: 'Mengusulkan perubahan',
  suggestion_selfapply: 'Melengkapi kata',
  suggestion_created: 'Mengusulkan perubahan',
  contribution_submitted: 'Mengusulkan kata baru',
  search_miss: '',
  user_joined: 'Bergabung di SambasKu',
  card_shared: 'Membagikan kartu',
  announcement: 'Pengumuman',
};

/** Entity type votes untuk kind event vote (legacy hydration #94). */
function voteEntityTypeOfKind(kind: ActivityEventKind): 'word' | 'comment' | 'meaning' {
  if (kind === 'vote_word') return 'word';
  if (kind === 'vote_meaning') return 'meaning';
  return 'comment';
}

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

/** Kategori timeline profil publik (19-api-profil-publik). */
type ProfileCategory =
  | 'contribution'
  | 'correction'
  | 'comment'
  | 'verification'
  | 'vote';

/**
 * Kind event -> kategori profil. Empat set lama (kontrak 19-api-profil-publik)
 * tetap utuh; `correction` ditambahkan agar chip "Perbaikan" profil = set
 * "Perbaikan" feed beranda (#193), bukan `contribution` yang masih memuat
 * `word_created`/`contribution_submitted`.
 */
const PROFILE_KIND_SETS: Record<ProfileCategory, ActivityEventKind[]> = {
  contribution: [
    'word_created',
    'contribution_image',
    'contribution_audio',
    'contribution_pron',
    'contribution_example',
    'suggestion_applied',
    'suggestion_created',
    'contribution_submitted',
    'place_photo_added',
  ],
  correction: FEED_CATEGORY_KINDS.correction!,
  comment: ['comment_created'],
  verification: ['word_verified', 'suggestion_selfapply'],
  vote: ['vote_word', 'vote_comment', 'vote_meaning'],
};

/** Mode merge profil: 1 query, 13 kind = gabungan 4 kategori (#103). */
const MERGED_PROFILE_KINDS: ActivityEventKind[] = [
  ...PROFILE_KIND_SETS.contribution,
  ...PROFILE_KIND_SETS.comment,
  ...PROFILE_KIND_SETS.verification,
  ...PROFILE_KIND_SETS.vote,
];

function profileCategoryOf(kind: ActivityEventKind): ProfileCategory {
  const hit = (Object.keys(PROFILE_KIND_SETS) as ProfileCategory[]).find(
    (cat) => (PROFILE_KIND_SETS[cat] as readonly string[]).includes(kind),
  );
  return hit ?? 'contribution';
}

/**
 * Baris selectVisible + kolom JOIN (#103): semua kebutuhan buildItem/
 * listPublicByActor datang dari SATU query tanpa resolve per baris.
 */
interface FeedRow {
  id: string;
  kind: string;
  actorId: string | null;
  targetWordId: string | null;
  targetId: string | null;
  occurredAt: Date;
  payload: string | null;
  wordStatus: string | null;
  lemma: string | null;
  actorUserId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  actorRole: string | null;
  actorDeletedAt: Date | null;
  missTerm: string | null;
  /** #144: arah search-miss untuk di-wirer ke target.direction di feed. */
  missDirection: string | null;
  voteValue: number | null;
  /** #187: tempat untuk place_photo_added (LEFT JOIN places, published saja). */
  placeSlug: string | null;
  placeName: string | null;
}

export class ActivityEventFeedRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  /**
   * Halaman feed beranda. Keyset (occurred_at, id) desc.
   *
   * @param kinds #193: filter kategori chips. `undefined`/`null`/kosong =
   *   semua kind (`null` = kategori "Semua", jangan `[]`). Dijamin satu
   *   query yang sama (tidak ada N+1): visibility kata, aktor, dan term
   *   search-miss ikut lewat JOIN di `selectVisible`.
   */
  async listFeed(
    limit: number,
    before?: ActivityCursor,
    excludeUserId?: string,
    kinds?: ActivityEventKind[] | null,
  ): Promise<ActivityItem[]> {
    // #56: event superseded (usulan yang ceritanya sudah jadi verifikasi)
    // tidak tayang di feed home - profil (listByActor) tetap memuatnya.
    const rows = await this.selectVisible(
      limit,
      before,
      excludeUserId,
      undefined,
      kinds,
      true,
    );
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
    category: ProfileCategory | 'merged',
    limit: number,
    cursor?: string,
  ): Promise<{ items: PublicActivityItem[]; nextCursor: string | null; hasMore: boolean }> {
    // 'merged' = 1 query utk semua kategori (use-case profil dulu memanggil
    // method ini 4x paralel -> 4 subrequest tiap kali; #103).
    const kinds =
      category === 'merged'
        ? MERGED_PROFILE_KINDS
        : PROFILE_KIND_SETS[category];
    const rows = await this.selectVisible(
      limit + 1,
      cursor ? cursorFromEventId(cursor) : undefined,
      undefined,
      actorId,
      kinds,
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: PublicActivityItem[] = [];
    for (const row of page) {
      const kind = row.kind as ActivityEventKind;
      // #103: lemma & arah vote datang dari JOIN selectVisible - tanpa
      // resolveWord / query tabel votes per baris.
      const lemma = row.targetWordId ? row.lemma : null;
      // #94: payload beku menang (satu sumber kebenaran feed+profil). Live
      // votes hanya fallback untuk event lama tanpa payload.
      const frozen = row.payload?.trim() || null;
      const voteValue = row.voteValue;
      items.push({
        id: row.id,
        // mode 'merged': kategori diturunkan dari kind (kontrak 4 kategori
        // profil tetap utuh).
        kind: category === 'merged' ? profileCategoryOf(kind) : category,
        occurredAt: row.occurredAt,
        wordId: row.targetWordId,
        lemma,
        summary: frozen
          ? this.applyLemmaPlaceholder(frozen, lemma)
          : this.publicSummary(kind, lemma, row.targetId, voteValue),
      });
    }
    return {
      items,
      nextCursor: hasMore && page[page.length - 1] ? page[page.length - 1]!.id : null,
      hasMore,
    };
  }

  /**
   * #56: payload beku boleh menyimpan placeholder `{lemma}` (kata belum
   * tentu published saat verify). Satu substitusi untuk feed beranda dan
   * timeline profil. Tanpa lemma JOIN, placeholder dibuang.
   */
  private applyLemmaPlaceholder(text: string, lemma: string | null): string {
    if (lemma) return text.replaceAll('{lemma}', lemma);
    return text.replaceAll(' {lemma}', '').replace('{lemma}', '');
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
      case 'place_photo_added':
        return 'Menambahkan foto wisata';
      case 'comment_created':
        return targetId ? `Mengomentari kata ${q}`.trim() : 'Mengomentari';
      case 'word_verified':
        return `Memverifikasi kata ${q}`.trim();
      case 'vote_word':
      case 'vote_comment':
      case 'vote_meaning':
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
      // #167: exclude self, kecuali announcement (admin pencipta tetap lihat
      // pengumumannya - itu broadcast, bukan karya pribadi).
      conds.push(
        sql`(${activityEvents.actorId} is null or ${activityEvents.actorId} <> ${excludeUserId} or ${activityEvents.kind} = 'announcement')`,
      );
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
    kinds?: ActivityEventKind[] | null,
    excludeSuperseded?: boolean,
  ) {
    const occurredAt = activityEvents.occurredAt;
    const conds = this.baseConditions(excludeUserId, actorId);
    if (excludeSuperseded) {
      // #56: superseded = cerita lama yang sudah digantikan verifikasi.
      conds.push(sql`${activityEvents.supersededAt} is null`);
    }
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
        // copy beku saat kejadian (#94): null = fallback bodyFor read-time
        payload: activityEvents.payload,
        // status kata untuk keputusan CTA (pending = tanpa target)
        wordStatus: words.status,
        // #103: field dari JOIN - ganti resolveWord/resolveActor per baris.
        lemma: words.lemma,
        actorUserId: users.id,
        actorUsername: users.username,
        actorDisplayName: users.displayName,
        actorAvatarUrl: users.avatarUrl,
        actorRole: highestUserRoleSql,
        actorDeletedAt: users.deletedAt,
        // search_miss: term body feed; guard kind supaya kolisi id antar
        // tabel (ULID) tak pernah match utk kind lain.
        missTerm: searchMisses.term,
        // #144: arah search-miss (term Indonesia vs kata Sambas).
        missDirection: searchMisses.direction,
        // fallback arah vote utk event lama tanpa payload (#94) — diisi
        // batch terpisah sesudah rows terfetch (bukan JOIN per baris).
        voteValue: sql<number | null>`null`,
        placeSlug: places.slug,
        placeName: places.name,
      })
      .from(activityEvents)
      .leftJoin(
        words,
        and(
          eq(words.id, activityEvents.targetWordId),
          // hanya kata layak-tayang yang lolos; event tanpa kata ikut (left join).
          // Kata pending (usulan baru) tetap dijoin supaya lemma kebaca;
          // event-nya dikecualikan dari filter published lewat join ini.
          sql`(${this.feedSafeWordSql()} or ${activityEvents.kind} = 'contribution_submitted')`,
        ),
      )
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .leftJoin(
        places,
        and(
          eq(activityEvents.kind, 'place_photo_added'),
          eq(places.id, activityEvents.targetId),
          eq(places.status, 'published'),
          sql`${places.deletedAt} is null`,
        ),
      )
      .leftJoin(
        searchMisses,
        and(
          eq(activityEvents.kind, 'search_miss'),
          eq(searchMisses.id, activityEvents.targetId),
        ),
      )
      .where(
        and(
          ...conds,
          // event yang menyebut kata harus lolos visibility kata;
          // event tanpa kata (welcome, search_miss tanpa word) tetap masuk.
          sql`(${activityEvents.targetWordId} is null or ${words.id} is not null)`,
          // #187: foto wisata hanya tayang selama tempatnya published.
          sql`(${activityEvents.kind} <> 'place_photo_added' or ${places.id} is not null)`,
        ),
      )
      .orderBy(desc(activityEvents.occurredAt), desc(activityEvents.id))
      .limit(limit);
    await this.hydrateLegacyVoteDirection(rows);
    return rows;
  }

  /**
   * Fallback arah vote untuk event lama tanpa payload (#94): satu query
   * batch `IN (...)` - bukan JOIN votes per baris (baca semua vote si
   * actor per event = ratusan rows untuk user aktif). Event pasca-#94
   * selalu punya payload beku → nol query tambahan.
   */
  private async hydrateLegacyVoteDirection(rows: FeedRow[]): Promise<void> {
    const pending = rows.filter(
      (r) =>
        (r.kind === 'vote_word' ||
          r.kind === 'vote_comment' ||
          r.kind === 'vote_meaning') &&
        !r.payload?.trim() &&
        r.actorId &&
        r.targetId,
    );
    if (pending.length === 0) return;
    const value = votes.value;
    const found = await this.db
      .select({
        userId: votes.userId,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value,
      })
      .from(votes)
      .where(
        or(
          ...pending.map((r) =>
            and(
              eq(votes.userId, r.actorId!),
              eq(votes.entityType, voteEntityTypeOfKind(r.kind as ActivityEventKind)),
              eq(votes.entityId, r.targetId!),
            ),
          ),
        ),
      );
    const dir = new Map(
      found.map((v) => [`${v.userId}:${v.entityType}:${v.entityId}`, v.value]),
    );
    for (const r of pending) {
      r.voteValue =
        dir.get(
          `${r.actorId}:${voteEntityTypeOfKind(r.kind as ActivityEventKind)}:${r.targetId}`,
        ) ??
        null;
    }
  }

  // ----------------------------------------------------------------- build --

  private buildItems(rows: FeedRow[]): ActivityItem[] {
    const out: ActivityItem[] = [];
    for (const row of rows) {
      const item = this.buildItem(row);
      if (item) out.push(item);
    }
    return out;
  }

  private buildItem(row: FeedRow): ActivityItem | null {
    const kind = row.kind as ActivityEventKind;
    // #103: semua field datang dari JOIN selectVisible - tanpa query per baris.
    const actor = this.actorFromRow(row);
    const word =
      row.targetWordId && row.lemma !== null
        ? { id: row.targetWordId, lemma: row.lemma }
        : null;
    let lemma = word?.lemma ?? null;

    // search_miss: lemma tidak ada; body pakai term aslinya (dari JOIN).
    if (kind === 'search_miss') {
      lemma = row.missTerm ?? null;
    }

    // Copy beku saat kejadian (#94) menang; fallback bodyFor untuk event
    // lama/backfill tanpa payload. #56: payload verifikasi menyimpan
    // placeholder {lemma} (kata belum tentu published saat verify) -
    // disubstitusi read-time dengan lemma JOIN.
    const frozen = row.payload?.trim() ? row.payload.trim() : null;
    // #124: payload announcement = JSON {title,...} - bukan copy human.
    // Body wire announcement diisi setelah parse di bawah.
    const isAnnouncement = kind === 'announcement';
    const body =
      isAnnouncement
        ? ''
        : frozen !== null
          ? this.applyLemmaPlaceholder(frozen, lemma)
          : this.bodyFor(kind, lemma);
    const subtitle =
      kind === 'place_photo_added' ? row.placeName : this.subtitleFor(kind, lemma);
    // #99: arah vote dari copy beku (#94) - event kind DB tetap vote_word/
    // vote_comment, split cuma di wire supaya feed home variatif tanpa
    // migrasi kinds (kinds DB = kontrak AGENTS.md #25).
    let wire: ActivityKind = KIND_TO_WIRE[kind];
    if (wire === 'vote') {
      wire = /perlu dicek ulang/.test(body) ? 'vote_down' : 'vote_up';
    }
    // Kata masih pending (usulan baru): tampil tanpa CTA - target null.
    // Setelah approve, read-time join published menghidupkan CTA lagi.
    // Kecuali #166: contribution_submitted (usul kata baru) tetap bawa
    // target + status 'pending_review' supaya verifikator bisa shortcut
    // ke antrean review dari feed; non-verifikator cukup tahu masih menunggu.
    let target: ActivityItem['target'];
    if (row.wordStatus && row.wordStatus !== 'published') {
      target =
        kind === 'contribution_submitted' && word
          ? { type: 'word', id: word.id, status: 'pending_review' }
          : null;
    } else {
      target = this.targetFor(kind, row, word);
    }

    // #102 announcement: payload beku = JSON {title, body, actionUrl,
    // actionLabel, expiresAt}. Kadaluarsa = tetap tayang tapi expired=true
    // (mobile menandai & menonaktifkan action) supaya feed tak bergeser.
    let announcement: ActivityItem['announcement'] = null;
    // #124: body wire announcement = title human-readable (bukan JSON beku).
    let announcementTitle = 'Pengumuman';
    let announcementBody: string | null = null;
    if (kind === 'announcement') {
      let parsed: {
        title?: unknown;
        body?: unknown;
        bodyType?: unknown;
        actionUrl?: unknown;
        actionLabel?: unknown;
        expiresAt?: unknown;
      } | null = null;
      try {
        parsed = frozen ? JSON.parse(frozen) : null;
      } catch {
        parsed = null;
      }
      if (typeof parsed?.title === 'string' && parsed.title.trim()) {
        announcementTitle = parsed.title.trim();
      }
      if (typeof parsed?.body === 'string' && parsed.body.trim()) {
        announcementBody = parsed.body;
      }
      const bodyTypes = ['plain', 'html', 'md', 'webview'] as const;
      const bodyType = bodyTypes.includes(parsed?.bodyType as (typeof bodyTypes)[number])
        ? (parsed!.bodyType as (typeof bodyTypes)[number])
        : 'plain';
      announcement = {
        id: row.targetId ?? row.id,
        title: announcementTitle,
        body: announcementBody ?? announcementTitle,
        bodyType,
        actionUrl: typeof parsed?.actionUrl === 'string' ? parsed.actionUrl : null,
        actionLabel: typeof parsed?.actionLabel === 'string' ? parsed.actionLabel : null,
        expired:
          typeof parsed?.expiresAt === 'number' && parsed.expiresAt <= Date.now(),
      };
    }

    return {
      id: `${wire}:${row.id}`,
      kind: wire as ActivityKind,
      createdAt: row.occurredAt,
      actor,
      // #124: announcement pakai title human-readable; kind lain copy beku.
      body: isAnnouncement ? announcementTitle : body,
      subtitle,
      target,
      announcement,
    };
  }

  /**
   * Transform JOIN users -> bentuk wire. Replikasi 1:1 resolveActor lama
   * (per-baris query) - #103 N+1 dihilangkan, perilaku identik.
   */
  private actorFromRow(row: FeedRow) {
    if (!row.actorUserId) return null;
    const username = publicAccountName(row.actorUsername!, row.actorDeletedAt);
    const displayName = publicAccountDisplayName(
      row.actorDisplayName,
      row.actorUsername,
      row.actorDeletedAt,
    );
    // Akun terhapus: karya tetap tayang berlabel, tapi tidak bisa dibuka profilnya.
    const hidden = !!row.actorDeletedAt || row.actorUserId === ANONIM_USER_ID;
    return {
      username: hidden ? null : username,
      displayName: username || displayName ? displayName ?? DELETED_LABEL : null,
      avatarUrl: row.actorDeletedAt ? null : (row.actorAvatarUrl ?? null),
      isVerifier: hidden ? false : isVerifierRole(row.actorRole ?? ''),
    };
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
      case 'contribution_submitted':
        // #166: lemma di body supaya baris usulan dikenali (kontrak 37-doc).
        return lemma
          ? `${KIND_BODY[kind]} · ${quoted(lemma)}`
          : KIND_BODY[kind];
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
      // #132: subtitle 'Verifikasi' duplikat kindLabel mobile ('Verifikasi')
      // sehingga meta jadi "Verifikasi · Verifikasi". Selfapply pun salah
      // kategori (kindLabel 'Usulan' + subtitle 'Verifikasi'). Keduanya null.
      case 'word_verified':
      case 'suggestion_selfapply':
        return null;
      case 'suggestion_created':
        return 'Usulan baru';
      // #166: 'Usulan kata baru' duplikat dengan kindLabel mobile
      // (#132 pola sama untuk word_verified / suggestion_selfapply).
      case 'contribution_submitted':
        return null;
      case 'user_joined':
        return 'Selamat datang';
      default:
        return lemma;
    }
  }

  private targetFor(
    kind: ActivityEventKind,
    row: {
      targetId: string | null;
      targetWordId: string | null;
      missDirection: string | null;
      placeSlug?: string | null;
    },
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
        // #190: target wire = id KATA (navigasi detail kata), bukan id
        // komentar yang tersimpan di targetId. Kontrak docs 37 + feed lama
        // (activity.repository.impl listRecentComments pakai wordId).
        return row.targetWordId ? { type: 'word', id: row.targetWordId! } : null;
      case 'vote_comment':
        return row.targetWordId ? { type: 'word', id: row.targetWordId! } : null;
      case 'vote_meaning':
        return row.targetWordId ? { type: 'word', id: row.targetWordId! } : null;
      case 'discussion_created':
        return row.targetId ? { type: 'discussion', id: row.targetId! } : null;
      case 'search_miss':
        return row.targetId
          ? {
              type: 'search_miss',
              id: row.targetId!,
              // #144: arah pencarian untuk prefill form usul di mobile.
              direction:
                row.missDirection === 'lemma' || row.missDirection === 'translation'
                  ? row.missDirection
                  : null,
            }
          : null;
      case 'place_photo_added':
        return row.placeSlug ? { type: 'place', id: row.placeSlug } : null;
      case 'user_joined':
        return row.targetId ? { type: 'user', id: row.targetId! } : null;
      case 'announcement':
        return row.targetId ? { type: 'announcement', id: row.targetId! } : null;
      default:
        return null;
    }
  }
}

const DELETED_LABEL = 'Akun tidak ditemukan';
