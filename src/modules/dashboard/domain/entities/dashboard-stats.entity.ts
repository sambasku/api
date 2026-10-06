export type WordStatusKey = 'draft' | 'pending_review' | 'published' | 'rejected';
export type ContributionStatusKey = 'pending' | 'approved' | 'rejected' | 'corrected';
export type AppRoleKey = 'root' | 'admin' | 'editor' | 'reviewer' | 'contributor';

/** Satu titik aktivitas harian (tanggal kalender WIB) - 5 series. */
export interface ActivityDailyPoint {
  /** 'YYYY-MM-DD' di zona WIB */
  date: string;
  /** usulan kontribusi masuk (exclude soft-deleted) */
  contributions: number;
  /** baris vote baru (engagement) */
  votes: number;
  /** komentar baru (exclude soft-deleted) */
  comments: number;
  /** registrasi user baru (exclude soft-deleted) */
  newUsers: number;
  /** pencarian (hit + miss) hari itu */
  searches: number;
}

export interface ProblemSourceCounts {
  open: number;
  /** resolved (+ rejected untuk bug) */
  closed: number;
}

/** Snapshot permasalahan (bug + laporan kata). */
export interface ProblemsStats {
  open: number;
  closed: number;
  bySource: {
    bugReports: ProblemSourceCounts;
    wordReports: ProblemSourceCounts;
  };
}

/** Snapshot pengajuan verifikator per status. */
export interface VerifierApplicationsStats {
  pending: number;
  approved: number;
  rejected: number;
}

// Statistik agregat halaman dashboard admin (GET /api/v1/admin/dashboard/stats).
// Semua angka kata/contributions sudah meng-exclude yang soft-deleted.
export interface DashboardStats {
  words: {
    /** jumlah entri belum soft-deleted (semua status) */
    total: number;
    /** belum soft-deleted + is_verified */
    verified: number;
    /** soft-deleted */
    deleted: number;
    byStatus: Record<WordStatusKey, number>;
  };
  contributions: {
    /** belum soft-deleted (semua status) */
    total: number;
    byStatus: Record<ContributionStatusKey, number>;
  };
  users: {
    /** belum soft-deleted + is_active */
    active: number;
    /**
     * Presence piggyback: last_seen_at dalam 15 menit terakhir
     * (bukan heartbeat realtime).
     */
    onlineRecently: number;
    /** Count user per role dari junction user_roles (multi role: user bisa masuk >1 role). */
    byRole: Record<AppRoleKey, number>;
  };
  activity: {
    /** jumlah baris audit log 7 hari terakhir (indikator aktivitas mutasi) */
    auditLogsLast7Days: number;
    /**
     * 30 hari kalender WIB inklusif (today-29 … today).
     * Hari tanpa aktivitas tetap ada dengan angka 0 (panjang selalu 30).
     */
    dailyLast30Days: ActivityDailyPoint[];
  };
  problems: ProblemsStats;
  verifierApplications: VerifierApplicationsStats;
}
