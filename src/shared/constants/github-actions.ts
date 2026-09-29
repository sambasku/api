// User sistem penampung trigger backup terjadwal (cron GitHub Actions
// di repo sambasku/sqlite). Log database_backup_logs memakai id ini
// saat event=schedule supaya "Trigger by" di console tidak kosong.
// ID ULID STABIL - idempoten di seeder, konsisten antar environment.
// Harus sama dengan konstanta di workflow sqlite (lihat sqlite/README).
export const GITHUB_ACTIONS_USER_ID = '01GHACTIONS'.padEnd(26, '0');
export const GITHUB_ACTIONS_USERNAME = 'GitHub Actions';
export const GITHUB_ACTIONS_EMAIL = 'github-actions@sambasku.com';
