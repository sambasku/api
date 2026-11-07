-- Usulan yang entitasnya sudah terverifikasi, status antrean masih pending.
-- Tanpa baris review dan tanpa inbox: data lama, jangan spam notifikasi.
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'word'
  AND `entity_id` IN (
    SELECT `id` FROM `words`
    WHERE `is_verified` = 1 AND `deleted_at` IS NULL
  );
--> statement-breakpoint
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'meaning'
  AND `entity_id` IN (
    SELECT `id` FROM `meanings`
    WHERE `is_verified` = 1 AND `status` = 'published' AND `deleted_at` IS NULL
  );
--> statement-breakpoint
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'pronunciation'
  AND `entity_id` IN (
    SELECT `id` FROM `pronunciations`
    WHERE `is_verified` = 1 AND `status` = 'published' AND `deleted_at` IS NULL
  );
--> statement-breakpoint
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'word_image'
  AND `entity_id` IN (
    SELECT `id` FROM `word_images`
    WHERE `is_verified` = 1 AND `status` = 'published' AND `deleted_at` IS NULL
  );
--> statement-breakpoint
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'word_audio'
  AND `entity_id` IN (
    SELECT `id` FROM `word_audios`
    WHERE `is_verified` = 1 AND `status` = 'published' AND `deleted_at` IS NULL
  );
--> statement-breakpoint
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'example'
  AND `entity_id` IN (
    SELECT `id` FROM `examples`
    WHERE `is_verified` = 1 AND `status` = 'published' AND `deleted_at` IS NULL
  );
--> statement-breakpoint
-- Sumber merge: kata sudah dihapus, ada kembaran published lemma+bahasa yang sama.
UPDATE `contributions`
SET `status` = 'approved', `reopened_by` = NULL
WHERE `deleted_at` IS NULL
  AND `status` = 'pending'
  AND `entity_type` = 'word'
  AND `entity_id` IN (
    SELECT `w`.`id` FROM `words` AS `w`
    WHERE `w`.`deleted_at` IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM `words` AS `twin`
        WHERE `twin`.`deleted_at` IS NULL
          AND `twin`.`status` = 'published'
          AND `twin`.`language_id` = `w`.`language_id`
          AND lower(`twin`.`lemma`) = lower(`w`.`lemma`)
          AND `twin`.`id` != `w`.`id`
      )
  );
