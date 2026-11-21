import type {
  ContentLinkEndpoint,
  ContentLinkKind,
  ContentLinkRow,
} from './content-link';

export interface ContentLinkRepository {
  /** Semua edge yang menyentuh endpoint (a atau b). */
  listForEndpoint(
    kind: ContentLinkKind,
    id: string,
  ): Promise<ContentLinkRow[]>;

  /**
   * Hapus semua edge anchor lalu insert set baru (replace-set).
   * Pairs sudah kanonik dan tervalidasi.
   */
  replaceForAnchor(input: {
    anchor: ContentLinkEndpoint;
    pairs: Array<{ a: ContentLinkEndpoint; b: ContentLinkEndpoint }>;
    createdBy: string | null;
  }): Promise<void>;
}
