-- Data Pendukung (sitasi sumber) per sesi impor massal.
ALTER TABLE `word_import_sessions` ADD `support_name` text;
ALTER TABLE `word_import_sessions` ADD `support_type` text;
ALTER TABLE `word_import_sessions` ADD `support_address` text;
ALTER TABLE `word_import_sessions` ADD `support_title` text;
ALTER TABLE `word_import_sessions` ADD `support_desc` text;
