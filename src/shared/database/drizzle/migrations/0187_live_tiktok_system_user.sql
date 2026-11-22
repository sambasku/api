-- Seed user sistem Live TikTok (streaming live dari platform TikTok).
-- ID ULID stabil `01LIVETIKTOK0000000000000000` - konsisten dengan
-- src/shared/constants/live-tiktok.ts dan seeder seed-reference.ts.
-- Idempoten: ON CONFLICT DO NOTHING per target.

INSERT INTO users (id, username, display_name, email, password_hash, email_verified, created_at, updated_at)
VALUES (
  '01LIVETIKTOK0000000000000000',
  'live_tiktok',
  'Live TikTok',
  'live-tiktok@sambasku.com',
  '-- sistem, bukan akun login --',
  1,
  unixepoch(),
  unixepoch()
) ON CONFLICT (id) DO NOTHING;

-- Role contributor (junction user_roles) - sama seperti user sistem lain.
INSERT INTO user_roles (id, user_id, role, created_at)
VALUES (
  lower(hex(randomblob(16))),
  '01LIVETIKTOK0000000000000000',
  'contributor',
  unixepoch()
) ON CONFLICT DO NOTHING;

-- Auto-exclude dari leaderboard (PK = user_id).
INSERT INTO leaderboard_excluded_users (user_id, note, created_at)
VALUES (
  '01LIVETIKTOK0000000000000000',
  'Akun sistem bawaan',
  unixepoch()
) ON CONFLICT (user_id) DO NOTHING;
