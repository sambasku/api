/** Jenis baris feed lintas aktivitas publik (37-api-activity-feed). */
export type ActivityKind =
  | 'word'
  | 'comment'
  | 'vote'
  | 'discussion'
  | 'word_image'
  | 'word_audio'
  | 'pronunciation'
  | 'example'
  | 'search_miss'
  | 'welcome'
  | 'card_share'
  | 'suggestion'
  | 'contribution'
  | 'verification'
  | 'vote_up'
  | 'vote_down'
  | 'announcement'
  | 'place_photo'
  | 'usaha_photo'
  | 'place_listing'
  | 'event'
| 'usaha'
| 'layanan'
  | 'community'
| 'karya'
| 'culinary'
| 'pantun'
| 'article'
| 'jinye'
  | 'chat'
  | 'leaderboard_rank';

export interface ActivityActor {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Centang verifikator di samping nama. False untuk akun tersembunyi. */
  isVerifier: boolean;
}

export interface ActivityTarget {
  type: string;
  id: string;
  /**
   * #144: arah pencarian search-miss. `lemma` = kata Sambas dicari,
   * `translation` = kata Indonesia dicari. Null untuk kind lain - mobile
   * memakai ini agar prefill form usul mengisi field yang benar.
   */
  direction?: 'lemma' | 'translation' | null;
  /**
   * #166: status wire target. `pending_review` = usulan masih perlu review
   * (DB boleh sudah `published` + belum verified; verifikator shortcut ke
   * antrean). Null/`published` = kata tayang normal.
   */
  status?: 'published' | 'pending_review' | null;
}

export interface ActivityItem {
  /** Stabil: `{kind}:{entityId}` untuk dedupe. */
  id: string;
  kind: ActivityKind;
  createdAt: Date;
  actor: ActivityActor | null;
  body: string;
  subtitle: string | null;
  target: ActivityTarget | null;
  /** Thumbnail gambar pertama untuk tile feed (null = tanpa media gambar). */
  previewImageUrl?: string | null;
  /** Jumlah gambar jika > 1 (batch / galeri). */
  previewImageCount?: number | null;
  /** #102: data pengumuman (payload beku) untuk tile + detail mobile. Null = kind lain. */
  announcement?: {
    id: string;
    title: string;
    body: string;
    /** #124 lanjutan: plain | html | md | webview (default plain). */
    bodyType: 'plain' | 'html' | 'md' | 'webview';
    actionUrl: string | null;
    actionLabel: string | null;
    expired: boolean;
  } | null;
}
