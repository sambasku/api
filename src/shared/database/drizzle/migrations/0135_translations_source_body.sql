ALTER TABLE `translations` ADD `source_body` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `translations`
SET `source_body` = COALESCE(
  (
    SELECT `jinye`.`body`
    FROM `jinye`
    WHERE `jinye`.`id` = `translations`.`reff_id`
  ),
  ''
)
WHERE `reff` = 'jinye'
  AND (`source_body` IS NULL OR `source_body` = '');
