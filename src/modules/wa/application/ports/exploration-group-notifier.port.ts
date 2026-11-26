export const EXPLORATION_GROUP_EVENT_KEY = 'exploration_proposal_submitted';
export const LEMMA_MERGE_GROUP_EVENT_KEY = 'lemma_merge_submitted';
export const VERIFIER_APPLICATION_GROUP_EVENT_KEY = 'verifier_application_submitted';
export const COMMENT_MEDIA_GROUP_EVENT_KEY = 'comment_media_published';
export const EXPLORE_PHOTO_GROUP_EVENT_KEY = 'explore_photo_added';

export interface ExplorationGroupNotice {
  /** Label jenis di pesan grup, mis. "Usaha" atau "Wisata (perbaikan)". */
  jenis: string;
  name: string;
  userId: string;
  /** true saat usulan dikirim ulang dari status revisi. */
  resubmit?: boolean;
  /** Judul baris pertama opsional (default: "Usulan baru masuk." / "Usulan dikirim ulang."). */
  heading?: string;
  /** Log `wa_message_logs.event_key` (default: exploration_proposal_submitted). */
  eventKey?: string;
}

/** Kirim kabar usulan eksplorasi ke grup WhatsApp. Gagal kirim tidak melempar. */
export interface ExplorationGroupNotifier {
  notify(notice: ExplorationGroupNotice): Promise<void>;
}

export function formatExplorationGroupMessage(input: {
  jenis: string;
  name: string;
  from: string;
  resubmit?: boolean;
  heading?: string;
  /** Nama env non-prod, mis. `Staging`. Footer italic WA: _Dikirim dari Staging._ */
  envTag?: string | null;
}): string {
  const head =
    input.heading?.trim() ||
    (input.resubmit ? "Usulan dikirim ulang." : "Usulan baru masuk.");
  const name = input.name.trim() || "tanpa nama";
  const body = `${head}\nJenis: ${input.jenis}\nNama: ${name}\nDari: ${input.from}`;
  const tag = input.envTag?.trim();
  // WhatsApp italic: _teks_
  return tag ? `${body}\n\n_Dikirim dari ${tag}._` : body;
}
