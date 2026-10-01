export type ShareBackgroundProviderId = 'unsplash' | 'pixabay' | 'openverse';

export const SHARE_BACKGROUND_PROVIDER_IDS = [
  'unsplash',
  'pixabay',
  'openverse',
] as const satisfies readonly ShareBackgroundProviderId[];

export type ShareMediaKind = 'photo' | 'video';

export const SHARE_MEDIA_KINDS = ['photo', 'video'] as const satisfies readonly ShareMediaKind[];

export type ShareOrientation = 'portrait' | 'landscape' | 'square';

export const SHARE_ORIENTATIONS = [
  'portrait',
  'landscape',
  'square',
] as const satisfies readonly ShareOrientation[];

export const SHARE_PROVIDER_MEDIA: Record<ShareBackgroundProviderId, readonly ShareMediaKind[]> = {
  unsplash: ['photo'],
  pixabay: ['photo', 'video'],
  openverse: ['photo'],
};

export interface ShareBackgroundSearchOptions {
  media?: ShareMediaKind;
  orientation?: ShareOrientation;
}

export interface ShareBackgroundItem {
  id: string;
  url: string;
  photographer: string;
  username: string;
  attribution_url: string;
  /** Alias backward-compat untuk client lama. */
  unsplash_url: string;
  provider: ShareBackgroundProviderId;
  kind: ShareMediaKind;
  preview_url: string;
  width: number;
  height: number;
  duration_seconds: number;
  mime_type: string;
  /** Openverse (CC): label lisensi, mis. `CC BY 2.0`. Wajib di kredit. */
  license?: string;
  license_url?: string;
  /** Openverse: sumber asli, mis. `flickr`. */
  source?: string;
}

export type ShareBackgroundSort = 'relevant' | 'popular';

export interface ShareBackgroundProviderPort {
  readonly providerId: ShareBackgroundProviderId;
  /** @deprecated pakai providerId */
  readonly providerName: string;
  readonly supportedMedia: readonly ShareMediaKind[];
  search(
    query: string,
    limit: number,
    page: number,
    sort?: ShareBackgroundSort,
    options?: ShareBackgroundSearchOptions,
  ): Promise<ShareBackgroundItem[]>;
  /** Unsplash: wajib dipanggil saat user memilih foto (API Guidelines). */
  trackDownload?(id: string): Promise<boolean>;
}

export interface ShareBackgroundProviderInfo {
  id: ShareBackgroundProviderId;
  label: string;
  available: boolean;
  media: ShareMediaKind[];
}
