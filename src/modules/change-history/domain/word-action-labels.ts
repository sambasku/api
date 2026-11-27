// Judul baris timeline riwayat kata (kata + anak: arti, contoh, foto, dst).

const WORD_ACTIONS: Record<string, string> = {
  create: 'Kata ditambahkan',
  update: 'Kata diperbarui',
  publish: 'Kata ditayangkan',
  unpublish: 'Kata ditarik dari tayang',
  merge_publish: 'Kata digabung lalu ditayangkan',
  merge: 'Kata digabung',
  verify: 'Kata diverifikasi',
  unverify: 'Verifikasi kata dicabut',
  takedown: 'Kata diturunkan',
  restore: 'Kata dipulihkan',
  delete: 'Kata dihapus',
  comma_split: 'Kata dipecah',
  duplicate_vote: 'Memilih arti kembar',
  lemma_merge_approve: 'Penggabungan kata disetujui',
  suggest_edit_rejected: 'Usulan perbaikan ditolak',
  auto_flag_usage_label: 'Label penggunaan ditandai otomatis',
  undo_auto_flag_usage_label: 'Label otomatis dibatalkan',
};

const CHILD_ACTIONS: Record<string, Record<string, string>> = {
  meaning: {
    create: 'Arti ditambahkan',
    update: 'Arti diperbarui',
    delete: 'Arti dihapus',
    verify: 'Arti diverifikasi',
    unverify: 'Verifikasi arti dicabut',
    unverify_by_vote_quorum: 'Verifikasi arti dicabut karena suara',
    reject: 'Arti ditolak lewat suara',
  },
  example: { create: 'Contoh ditambahkan', update: 'Contoh diperbarui', delete: 'Contoh dihapus' },
  pronunciation: { create: 'Pelafalan ditambahkan', delete: 'Pelafalan dihapus' },
  word_image: {
    create: 'Foto ditambahkan',
    delete: 'Foto dihapus',
    'content_warnings.update': 'Peringatan konten foto diubah',
  },
  word_audio: { create: 'Rekaman suara ditambahkan', delete: 'Rekaman suara dihapus' },
};

const CHILD_FALLBACK: Record<string, string> = {
  meaning: 'Arti diperbarui',
  example: 'Contoh diperbarui',
  pronunciation: 'Pelafalan diperbarui',
  word_image: 'Foto diperbarui',
  word_audio: 'Rekaman suara diperbarui',
};

/** Entity anak kata yang ikut tampil di riwayat kata. */
export const WORD_CHILD_ENTITY_TYPES = [
  'meaning',
  'example',
  'pronunciation',
  'word_image',
  'word_audio',
] as const;

export function describeWordAction(entityType: string, action: string): string {
  if (entityType === 'word') {
    if (action.startsWith('suggest_edit_') && action !== 'suggest_edit_rejected') {
      return 'Usulan perbaikan diterapkan';
    }
    return WORD_ACTIONS[action] ?? 'Kata diperbarui';
  }
  return CHILD_ACTIONS[entityType]?.[action] ?? CHILD_FALLBACK[entityType] ?? 'Data diperbarui';
}
