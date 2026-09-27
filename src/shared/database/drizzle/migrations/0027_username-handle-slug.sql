-- username = handle @mention (a-z0-9._-); display_name = nama profil manusiawi.
-- 1) Backfill display_name kosong dari username lama.
-- 2) Slugify username yang tidak valid; collision → suffix numerik.

UPDATE users
SET display_name = username
WHERE (display_name IS NULL OR display_name = '')
  AND username IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, username
    FROM users
    WHERE username !~ '^[a-z0-9._-]{3,30}$'
  LOOP
    base := lower(r.username);
    base := regexp_replace(base, '[^a-z0-9._-]+', '-', 'g');
    base := regexp_replace(base, '-{2,}', '-', 'g');
    base := trim(both '._-' from base);
    IF char_length(base) > 30 THEN
      base := left(base, 30);
      base := trim(both '._-' from base);
    END IF;
    IF base IS NULL OR base = '' OR char_length(base) < 3 THEN
      base := 'user';
    END IF;

    candidate := base;
    n := 2;
    WHILE EXISTS (
      SELECT 1 FROM users u WHERE u.username = candidate AND u.id <> r.id
    ) LOOP
      candidate := left(base, greatest(1, 30 - char_length(n::text))) || n::text;
      n := n + 1;
      IF n > 9999 THEN
        candidate := 'user' || substr(replace(r.id::text, '-', ''), 1, 8);
        EXIT;
      END IF;
    END LOOP;

    UPDATE users SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;
