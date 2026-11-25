export const EXPLORATION_GROUP_EVENT_KEY = 'exploration_proposal_submitted';
export const LEMMA_MERGE_GROUP_EVENT_KEY = 'lemma_merge_submitted';

export interface ExplorationGroupNotice {
  /** Label jenis di pesan grup, mis. "Usaha" atau "Wisata (perbaikan)". */
  jenis: string;
  name: string;
  userId: string;
  /** true saat usulan dikirim ulang dari status revisi. */
  resubmit?: boolean;
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
}): string {
  const head = input.resubmit ? "Usulan dikirim ulang." : "Usulan baru masuk.";
  const name = input.name.trim() || "tanpa nama";
  return `${head}\nJenis: ${input.jenis}\nNama: ${name}\nDari: ${input.from}`;
}
