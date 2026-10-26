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
  | 'pantun_reply'
  | 'pantun_mention'
  | 'word_comment'
  | 'word_comment_mention'
  | 'word_vote'
  /** #133: pemilik kata dapat notif saat contoh/pelafalan tayang. */
  | 'word_example'
  | 'word_audio'
  | 'campaign'
| 'verifier_application_approved'
| 'verifier_application_rejected'
  | 'place_contribution_approved'
  | 'place_contribution_rejected'
  | 'event_contribution_approved'
  | 'event_contribution_rejected'
  | 'event_contribution_needs_revision'
  | 'usaha_contribution_approved'
  | 'usaha_contribution_rejected'
  | 'usaha_contribution_needs_revision'
  | 'usaha_claim_approved'
  | 'usaha_claim_rejected'
  | 'culinary_contribution_approved'
  | 'culinary_contribution_rejected'
  | 'culinary_contribution_needs_revision'
  | 'culinary_claim_approved'
  | 'culinary_claim_rejected'
  | 'achievement_awarded'
  | 'pantun_reply'
  | 'pantun_mention';

export type NotificationTargetKind =
  | 'contribution'
  | 'suggestion'
  | 'word'
  | 'discussion'
  | 'campaign'
  | 'verifier_application'
  | 'place_contribution'
  | 'event_contribution'
  | 'usaha_contribution'
  | 'usaha_claim'
  | 'culinary_contribution'
  | 'culinary_claim'
  | 'achievement'
  | 'pantun';

/** CTA tap (#19). Null = fallback ke target_kind/target_id. */
export type NotificationActionKind =
  | 'word'
  | 'contribution'
  | 'suggestion'
| 'discussion'
| 'url'
| 'place_contribution'
| 'event_contribution'
| 'usaha_contribution'
| 'usaha_claim'
| 'culinary_contribution'
| 'culinary_claim'
| 'pantun';

export interface InboxNotification {
  id: string;
  userId: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  bodyType: 'plain' | 'html' | 'md' | 'webview';
  imageUrl: string | null;
  targetKind: NotificationTargetKind;
  targetId: string;
  actionKind: NotificationActionKind | null;
  actionValue: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function inboxCopyFor(type: InboxNotificationType): { title: string; body: string; bodyType: 'plain' | 'html' | 'md' | 'webview' } {
  switch (type) {
    case 'contribution_approved':
      return {
        title: 'Kata sudah dicek',
        body: 'Tim sudah memeriksa usulanmu. Labelnya sekarang Terverifikasi.',
        bodyType: 'plain',
      };
    case 'contribution_rejected':
      return {
        title: 'Kata ditarik',
        body: 'Usulanmu ditarik dari kamus. Buka Kontribusi Saya untuk melihat alasan.',
        bodyType: 'plain',
      };
    case 'contribution_corrected':
      return {
        title: 'Usulan dikoreksi',
        body: 'Tim mengoreksi usulanmu. Entri tetap tayang dan sudah dicek.',
        bodyType: 'plain',
      };
    case 'suggestion_approved':
      return {
        title: 'Usulan perubahan selesai',
        body: 'Usulan perubahanmu selesai diperiksa.',
        bodyType: 'plain',
      };
    case 'suggestion_rejected':
      return {
        title: 'Usulan perubahan ditolak',
        body: 'Usulan perubahan ditolak. Buka Kontribusi Saya untuk melihat hasilnya.',
        bodyType: 'plain',
      };
    case 'suggestion_corrected':
      return {
        title: 'Usulan perubahan dikoreksi',
        body: 'Tim mengoreksi usulan perubahanmu dan menerapkannya.',
        bodyType: 'plain',
      };
    case 'word_taken_down':
      return {
        title: 'Entri ditarik',
        body: 'Entri yang kamu buat ditarik dari kamus.',
        bodyType: 'plain',
      };
    case 'contribution_paused':
      return {
        title: 'Kontribusi dihentikan',
        body: 'Kamu belum bisa mengirim usulan baru. Usulan yang sudah tayang tetap ada.',
        bodyType: 'plain',
      };
    case 'contribution_resumed':
      return {
        title: 'Kontribusi dibuka lagi',
        body: 'Kamu bisa mengirim usulan lagi.',
        bodyType: 'plain',
      };
    case 'discussion_pending_review':
      return {
        title: 'Diskusi menunggu tinjauan',
        body: 'Ada diskusi baru yang menunggu pemeriksaan.',
        bodyType: 'plain',
      };
    case 'discussion_approved':
      return {
        title: 'Diskusi tayang',
        body: 'Diskusimu sudah diperiksa dan tayang di feed.',
        bodyType: 'plain',
      };
    case 'discussion_rejected':
      return {
        title: 'Diskusi ditolak',
        body: 'Diskusimu ditolak. Buka riwayat untuk melihat alasan.',
        bodyType: 'plain',
      };
    case 'discussion_taken_down':
      return {
        title: 'Diskusi ditarik',
        body: 'Diskusimu ditarik dari feed.',
        bodyType: 'plain',
      };
    case 'discussion_reply':
      return {
        title: 'Balasan baru',
        body: 'Ada balasan baru di Ruang Diskusi.',
        bodyType: 'plain',
      };
    case 'discussion_mention':
      return {
        title: 'Kamu disebut di diskusi',
        body: 'Seseorang menyebutmu di Ruang Diskusi.',
        bodyType: 'plain',
      };
    case 'pantun_reply':
      return {
        title: 'Balasan pantun baru',
        body: 'Ada balasan baru di pantunmu.',
        bodyType: 'plain',
      };
    case 'pantun_mention':
      return {
        title: 'Kamu disebut di pantun',
        body: 'Seseorang menyebutmu di pantun.',
        bodyType: 'plain',
      };
    case 'word_comment':
      return {
        title: 'Komentar baru',
        body: 'Ada komentar baru di diskusi kosakata.',
        bodyType: 'plain',
      };
    case 'word_comment_mention':
      return {
        title: 'Kamu disebut di komentar',
        body: 'Seseorang menyebutmu di komentar kosakata.',
        bodyType: 'plain',
      };
  case 'word_vote':
    return {
      title: 'Vote baru',
      body: 'Ada penilaian baru pada kosakatamu.',
      bodyType: 'plain',
    };
  // #133: copy bawaan tanpa nama aktor; caller mengisi body saat tahu namanya.
  case 'word_example':
    return {
      title: 'Contoh baru',
      body: 'Ada contoh kalimat baru di kosakatamu.',
      bodyType: 'plain',
    };
  case 'word_audio':
    return {
      title: 'Pelafalan baru',
      body: 'Ada rekaman pelafalan baru di kosakatamu.',
      bodyType: 'plain',
    };
    case 'campaign':
      // Title/body campaign selalu dari snapshot admin (bukan copy bawaan).
      return { title: 'Pengumuman', body: '', bodyType: 'plain' };
    case 'verifier_application_approved':
      return {
        title: 'Selamat, kamu jadi verifikator',
        body: 'Pengajuanmu disetujui. Keluar lalu masuk lagi ya, biar peran Verifikator aktif di aplikasi.',
        bodyType: 'plain',
      };
case 'verifier_application_rejected':
return {
title: 'Pengajuan verifikator ditolak',
body: 'Pengajuan ditolak. Buka profil untuk memperbaiki.',
bodyType: 'plain',
};
case 'place_contribution_approved':
return {
title: 'Usulan wisata disetujui',
body: 'Usulanmu sudah tayang di daftar wisata. Terima kasih!',
bodyType: 'plain',
};
    case 'place_contribution_rejected':
      return {
        title: 'Usulan wisata ditolak',
        body: 'Usulanmu belum lolos tinjauan. Buka daftar usulan untuk detailnya.',
        bodyType: 'plain',
      };
    case 'event_contribution_approved':
      return {
        title: 'Usulan acara disetujui',
        body: 'Usulanmu sudah tayang di daftar acara. Terima kasih!',
        bodyType: 'plain',
      };
    case 'event_contribution_rejected':
      return {
        title: 'Usulan acara ditolak',
        body: 'Usulanmu belum lolos tinjauan. Buka daftar usulan untuk detailnya.',
        bodyType: 'plain',
      };
    case 'event_contribution_needs_revision':
      return {
        title: 'Usulan acara perlu revisi',
        body: 'Ada bagian yang perlu diperbaiki dulu. Buka daftar usulan untuk detailnya.',
        bodyType: 'plain',
      };
  case 'achievement_awarded':
    // Title/body spesifik achievement selalu dari caller (bukan copy bawaan).
    return { title: 'Pencapaian baru', body: '', bodyType: 'plain' };
  case 'usaha_contribution_approved':
    return {
      title: 'Usulan usaha disetujui',
      body: 'Usulanmu sudah tayang di daftar usaha. Terima kasih!',
      bodyType: 'plain',
    };
  case 'usaha_contribution_rejected':
    return {
      title: 'Usulan usaha ditolak',
      body: 'Usulanmu belum lolos tinjauan. Buka daftar usulan untuk detailnya.',
      bodyType: 'plain',
    };
  case 'usaha_contribution_needs_revision':
    return {
      title: 'Usulan usaha perlu revisi',
      body: 'Ada bagian yang perlu diperbaiki dulu. Buka daftar usulan untuk detailnya.',
      bodyType: 'plain',
    };
  case 'usaha_claim_approved':
    return {
      title: 'Klaim usaha disetujui',
      body: 'Kamu sekarang jadi pengelola usaha ini. Buka Usaha Saya untuk mulai mengelola.',
      bodyType: 'plain',
    };
  case 'usaha_claim_rejected':
    return {
      title: 'Klaim usaha ditolak',
      body: 'Klaim belum bisa disetujui. Buka Usaha Saya untuk lihat alasannya.',
      bodyType: 'plain',
    };
  case 'culinary_contribution_approved':
    return {
      title: 'Usulan kuliner disetujui',
      body: 'Usulanmu sudah tayang di Jelajah Kuliner. Terima kasih!',
      bodyType: 'plain',
    };
  case 'culinary_contribution_rejected':
    return {
      title: 'Usulan kuliner ditolak',
      body: 'Usulanmu belum lolos tinjauan. Buka daftar usulan untuk detailnya.',
      bodyType: 'plain',
    };
  case 'culinary_contribution_needs_revision':
    return {
      title: 'Usulan kuliner perlu revisi',
      body: 'Ada bagian yang perlu diperbaiki dulu. Buka daftar usulan untuk detailnya.',
      bodyType: 'plain',
    };
  case 'culinary_claim_approved':
    return {
      title: 'Klaim tempat disetujui',
      body: 'Kamu sekarang jadi pengelola tempat ini. Buka Jelajah Kuliner untuk mulai mengelola.',
      bodyType: 'plain',
    };
  case 'culinary_claim_rejected':
    return {
      title: 'Klaim tempat ditolak',
      body: 'Klaim belum bisa disetujui. Buka daftar klaim untuk lihat alasannya.',
      bodyType: 'plain',
    };
}
}
