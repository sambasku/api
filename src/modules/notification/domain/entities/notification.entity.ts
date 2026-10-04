export type InboxNotificationType =
  | 'contribution_approved'
  | 'contribution_rejected'
  | 'contribution_corrected'
  | 'suggestion_approved'
  | 'suggestion_rejected'
  | 'suggestion_corrected'
  | 'word_taken_down'
  | 'contribution_paused'
  | 'contribution_resumed'
  | 'discussion_pending_review'
  | 'discussion_approved'
  | 'discussion_rejected'
  | 'discussion_taken_down'
  | 'discussion_reply'
  | 'discussion_mention'
  | 'word_comment'
  | 'word_comment_mention'
  | 'word_vote'
  | 'campaign'
  | 'verifier_application_approved'
  | 'verifier_application_rejected';

export type NotificationTargetKind =
  | 'contribution'
  | 'suggestion'
  | 'word'
  | 'discussion'
  | 'campaign'
  | 'verifier_application';

/** CTA tap (#19). Null = fallback ke target_kind/target_id. */
export type NotificationActionKind =
  | 'word'
  | 'contribution'
  | 'suggestion'
  | 'discussion'
  | 'url';

export interface InboxNotification {
  id: string;
  userId: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  imageUrl: string | null;
  targetKind: NotificationTargetKind;
  targetId: string;
  actionKind: NotificationActionKind | null;
  actionValue: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function inboxCopyFor(type: InboxNotificationType): { title: string; body: string } {
  switch (type) {
    case 'contribution_approved':
      return {
        title: 'Kata sudah dicek',
        body: 'Tim sudah memeriksa usulanmu. Labelnya sekarang Terverifikasi.',
      };
    case 'contribution_rejected':
      return {
        title: 'Kata ditarik',
        body: 'Usulanmu ditarik dari kamus. Buka Kontribusi Saya untuk melihat alasan.',
      };
    case 'contribution_corrected':
      return {
        title: 'Usulan dikoreksi',
        body: 'Tim mengoreksi usulanmu. Entri tetap tayang dan sudah dicek.',
      };
    case 'suggestion_approved':
      return {
        title: 'Usulan perubahan selesai',
        body: 'Usulan perubahanmu selesai diperiksa.',
      };
    case 'suggestion_rejected':
      return {
        title: 'Usulan perubahan ditolak',
        body: 'Usulan perubahan ditolak. Buka Kontribusi Saya untuk melihat hasilnya.',
      };
    case 'suggestion_corrected':
      return {
        title: 'Usulan perubahan dikoreksi',
        body: 'Tim mengoreksi usulan perubahanmu dan menerapkannya.',
      };
    case 'word_taken_down':
      return {
        title: 'Entri ditarik',
        body: 'Entri yang kamu buat ditarik dari kamus.',
      };
    case 'contribution_paused':
      return {
        title: 'Kontribusi dihentikan',
        body: 'Kamu belum bisa mengirim usulan baru. Usulan yang sudah tayang tetap ada.',
      };
    case 'contribution_resumed':
      return {
        title: 'Kontribusi dibuka lagi',
        body: 'Kamu bisa mengirim usulan lagi.',
      };
    case 'discussion_pending_review':
      return {
        title: 'Diskusi menunggu tinjauan',
        body: 'Ada diskusi baru yang menunggu pemeriksaan.',
      };
    case 'discussion_approved':
      return {
        title: 'Diskusi tayang',
        body: 'Diskusimu sudah diperiksa dan tayang di feed.',
      };
    case 'discussion_rejected':
      return {
        title: 'Diskusi ditolak',
        body: 'Diskusimu ditolak. Buka riwayat untuk melihat alasan.',
      };
    case 'discussion_taken_down':
      return {
        title: 'Diskusi ditarik',
        body: 'Diskusimu ditarik dari feed.',
      };
    case 'discussion_reply':
      return {
        title: 'Balasan baru',
        body: 'Ada balasan baru di Ruang Diskusi.',
      };
    case 'discussion_mention':
      return {
        title: 'Kamu disebut di diskusi',
        body: 'Seseorang menyebutmu di Ruang Diskusi.',
      };
    case 'word_comment':
      return {
        title: 'Komentar baru',
        body: 'Ada komentar baru di diskusi kosakata.',
      };
    case 'word_comment_mention':
      return {
        title: 'Kamu disebut di komentar',
        body: 'Seseorang menyebutmu di komentar kosakata.',
      };
    case 'word_vote':
      return {
        title: 'Vote baru',
        body: 'Ada penilaian baru pada kosakatamu.',
      };
    case 'campaign':
      // Title/body campaign selalu dari snapshot admin (bukan copy bawaan).
      return { title: 'Pengumuman', body: '' };
    case 'verifier_application_approved':
      return {
        title: 'Selamat, kamu jadi verifikator',
        body: 'Pengajuanmu disetujui. Keluar lalu masuk lagi ya, biar peran Verifikator aktif di aplikasi.',
      };
    case 'verifier_application_rejected':
      return {
        title: 'Pengajuan verifikator ditolak',
        body: 'Pengajuan ditolak. Buka profil untuk memperbaiki.',
      };
  }
}
