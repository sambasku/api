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
  | 'verification';

export interface ActivityActor {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ActivityTarget {
  type: string;
  id: string;
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
}
