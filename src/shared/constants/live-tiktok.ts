// User sistem Live TikTok (streaming live dari platform TikTok).
// ID ULID STABIL - idempoten di seeder, konsisten antar environment.
// username = handle @mention (a-z0-9._, migrasi 0090 guard); display name
// manusiawi tetap "Live TikTok".
export const LIVE_TIKTOK_USER_ID = '01LIVETIKTOK'.padEnd(26, '0');
export const LIVE_TIKTOK_USERNAME = 'live_tiktok';
export const LIVE_TIKTOK_DISPLAY_NAME = 'Live TikTok';
export const LIVE_TIKTOK_EMAIL = 'live-tiktok@sambasku.com';