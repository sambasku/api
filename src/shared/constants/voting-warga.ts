// User sistem atributor auto-verifikasi makna dari quorum vote warga.
// Bukan akun login; dipakai verified_by saat net vote mencapai ambang
// (lihat docs/produk/trust-makna-hot-loop.md). ID ULID STABIL - idempoten
// di seeder, konsisten antar environment.
// username = handle slug; displayName = label manusiawi di UI/feed.
export const VOTING_WARGA_USER_ID = '01VOTWAR'.padEnd(26, '0');
export const VOTING_WARGA_USERNAME = 'votingwarga';
export const VOTING_WARGA_DISPLAY_NAME = 'Voting Warga';
export const VOTING_WARGA_EMAIL = 'votingwarga@sambasku.com';

/** Fallback default ambang (override lewat app_settings voting_warga_*_threshold). */
export const VOTING_WARGA_NET_THRESHOLD = 5;
export const VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD = 5;

/** @deprecated Dispute verified sekarang unverify+reset; nilai = -NET_THRESHOLD. */
export const VOTING_WARGA_NEEDS_REVIEW_NET = -5;
