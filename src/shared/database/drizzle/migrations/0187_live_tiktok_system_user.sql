-- Register user sistem Live TikTok ke daftar exclude leaderboard.
-- User + role dibuat seeder seed-reference.ts (prod sudah ada); migration
-- hanya memastikan masuk ignore list. INSERT ... SELECT (bukan VALUES)
-- supaya tidak error FK bila user belum lahir saat migrate (staging
-- fresh) - seeder akan menutup baris ini saat seed jalan.
INSERT INTO leaderboard_excluded_users (user_id, note, created_at)
SELECT id, 'Akun sistem bawaan', unixepoch()
FROM users
WHERE id = '01LIVETIKTOK0000000000000000'
ON CONFLICT (user_id) DO NOTHING;
