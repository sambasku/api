// User sistem penampung atribusi impor massal (CSV / lembar admin).
// Kata yang diimpor memakai created_by user ini supaya jejak data jelas
// berasal dari impor, bukan dari akun admin yang menekan Simpan.
// ID ULID STABIL - idempoten di seeder, konsisten antar environment.
// username = handle @mention (a-z0-9._, migrasi 0090 guard); display name
// manusiawi tetap "Pengimpor Data CSV".
export const CSV_IMPORTER_USER_ID = '01CSVIMP'.padEnd(26, '0');
export const CSV_IMPORTER_USERNAME = 'pengimpor_data_csv';
export const CSV_IMPORTER_DISPLAY_NAME = 'Pengimpor Data CSV';
export const CSV_IMPORTER_EMAIL = 'importir-csv@sambasku.com';
