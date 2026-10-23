// User sistem penampung pengajuan Web Importer (publik tanpa login).
// ID ULID STABIL - idempoten di seeder, konsisten antar environment.
// username = handle @mention (a-z0-9._, migrasi 0090 guard); display name
// manusiawi tetap "Web Import".
export const WEB_IMPORT_USER_ID = '01WEBIMP'.padEnd(26, '0');
export const WEB_IMPORT_USERNAME = 'web_import';
export const WEB_IMPORT_DISPLAY_NAME = 'Web Import';
export const WEB_IMPORT_EMAIL = 'webimport@sambasku.com';
