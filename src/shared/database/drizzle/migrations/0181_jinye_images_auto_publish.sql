-- Jinye foto auto-tayang: isi public_url dari url staging bila masih kosong.
-- images = JSON array di kolom jinye.images / jinye_comments.images.
UPDATE jinye
SET images = (
  SELECT json_group_array(
    CASE
      WHEN json_extract(je.value, '$.url') IS NOT NULL
        AND trim(json_extract(je.value, '$.url')) <> ''
        AND (
          json_extract(je.value, '$.public_url') IS NULL
          OR trim(COALESCE(json_extract(je.value, '$.public_url'), '')) = ''
        )
      THEN json_set(je.value, '$.public_url', json_extract(je.value, '$.url'))
      ELSE je.value
    END
  )
  FROM json_each(jinye.images) AS je
)
WHERE typeof(images) = 'text'
  AND length(images) > 2
  AND images != '[]';
--> statement-breakpoint
UPDATE jinye_comments
SET images = (
  SELECT json_group_array(
    CASE
      WHEN json_extract(je.value, '$.url') IS NOT NULL
        AND trim(json_extract(je.value, '$.url')) <> ''
        AND (
          json_extract(je.value, '$.public_url') IS NULL
          OR trim(COALESCE(json_extract(je.value, '$.public_url'), '')) = ''
        )
      THEN json_set(je.value, '$.public_url', json_extract(je.value, '$.url'))
      ELSE je.value
    END
  )
  FROM json_each(jinye_comments.images) AS je
)
WHERE typeof(images) = 'text'
  AND length(images) > 2
  AND images != '[]';
