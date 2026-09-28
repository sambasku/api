-- Jejak klaim batch impor ke user nyata (fase 2 atribusi).
ALTER TABLE `word_import_sessions` ADD `claimed_by` text REFERENCES `users`(`id`);
ALTER TABLE `word_import_sessions` ADD `claimed_at` integer;
