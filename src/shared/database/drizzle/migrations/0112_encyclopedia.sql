CREATE TABLE `encyclopedia_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `encyclopedia_categories_status_idx` ON `encyclopedia_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `encyclopedia_categories_sort_idx` ON `encyclopedia_categories` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `encyclopedia_tags` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `encyclopedia_tags_slug_uidx` ON `encyclopedia_tags` (`slug`);
--> statement-breakpoint
CREATE INDEX `encyclopedia_tags_name_idx` ON `encyclopedia_tags` (`name`);
--> statement-breakpoint
CREATE TABLE `articles` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `excerpt` text DEFAULT '' NOT NULL,
  `body_md` text NOT NULL,
  `body_text` text DEFAULT '' NOT NULL,
  `cover_url` text,
  `category_id` text NOT NULL,
  `source_url` text,
  `references_md` text,
  `author_user_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer,
  FOREIGN KEY (`category_id`) REFERENCES `encyclopedia_categories`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_uidx` ON `articles` (`slug`);
--> statement-breakpoint
CREATE INDEX `articles_category_idx` ON `articles` (`category_id`);
--> statement-breakpoint
CREATE INDEX `articles_status_idx` ON `articles` (`status`);
--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`published_at`);
--> statement-breakpoint
CREATE INDEX `articles_author_idx` ON `articles` (`author_user_id`);
--> statement-breakpoint
CREATE TABLE `article_tags` (
  `article_id` text NOT NULL,
  `tag_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tag_id`) REFERENCES `encyclopedia_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_tags_article_idx` ON `article_tags` (`article_id`);
--> statement-breakpoint
CREATE INDEX `article_tags_tag_idx` ON `article_tags` (`tag_id`);
--> statement-breakpoint
CREATE TABLE `article_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL,
  `article_id` text,
  `payload_json` text NOT NULL,
  `base_updated_at` integer,
  `status` text DEFAULT 'pending' NOT NULL,
  `result_article_id` text,
  `revision_note` text,
  `reject_reason_code` text,
  `reject_reason_text` text,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `reviewed_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_contributions_user_status_idx` ON `article_contributions` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `article_contributions_status_created_idx` ON `article_contributions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `article_contributions_article_idx` ON `article_contributions` (`article_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_contributions_active_edit_uidx` ON `article_contributions` (`article_id`,`user_id`) WHERE "article_contributions"."kind" = 'edit' and "article_contributions"."status" in ('pending','needs_revision');
--> statement-breakpoint
CREATE TABLE `article_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `article_id` text NOT NULL,
  `editor_id` text NOT NULL,
  `contribution_id` text,
  `title` text NOT NULL,
  `excerpt` text DEFAULT '' NOT NULL,
  `body_md` text NOT NULL,
  `category_id` text NOT NULL,
  `tags_json` text DEFAULT '[]' NOT NULL,
  `change_note` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_revisions_article_created_idx` ON `article_revisions` (`article_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `article_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `article_id` text NOT NULL,
  `user_id` text NOT NULL,
  `body` text NOT NULL,
  `body_original` text,
  `image_url` text,
  `status` text DEFAULT 'published' NOT NULL,
  `reviewed_by` text,
  `reviewed_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  `deleted_at` integer,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_comments_article_status_idx` ON `article_comments` (`article_id`,`status`,`id`);
--> statement-breakpoint
CREATE INDEX `article_comments_user_status_idx` ON `article_comments` (`user_id`,`status`,`id`);
--> statement-breakpoint
CREATE TABLE `article_comment_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `comment_id` text NOT NULL,
  `editor_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`comment_id`) REFERENCES `article_comments`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_comment_revisions_comment_idx` ON `article_comment_revisions` (`comment_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `article_bookmarks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `article_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_bookmarks_user_article_uidx` ON `article_bookmarks` (`user_id`,`article_id`);
--> statement-breakpoint
CREATE INDEX `article_bookmarks_user_idx` ON `article_bookmarks` (`user_id`,`id`);
--> statement-breakpoint
CREATE TABLE `article_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `user_id` text NOT NULL,
  `reason_code` text NOT NULL,
  `note` text,
  `status` text DEFAULT 'open' NOT NULL,
  `resolution` text,
  `resolution_note` text,
  `resolved_by` text,
  `resolved_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_reports_status_id_idx` ON `article_reports` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `article_reports_target_idx` ON `article_reports` (`target_type`,`target_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_reports_open_user_uidx` ON `article_reports` (`target_type`,`target_id`,`user_id`) WHERE "article_reports"."status" = 'open';
--> statement-breakpoint
-- Seed kategori ensiklopedia (id = slug stabil, dipakai UI + URL).
INSERT INTO `encyclopedia_categories` (`id`, `name`, `status`, `sort_order`, `created_at`) VALUES
  ('sejarah', 'Sejarah', 'published', 10, unixepoch()),
  ('tokoh', 'Tokoh', 'published', 20, unixepoch()),
  ('budaya-tradisi', 'Budaya dan Tradisi', 'published', 30, unixepoch()),
  ('karya', 'Karya dan Sastra', 'published', 40, unixepoch()),
  ('tempat', 'Tempat dan Geografi', 'published', 50, unixepoch()),
  ('bahasa', 'Bahasa', 'published', 60, unixepoch()),
  ('lainnya', 'Lainnya', 'published', 99, unixepoch())
ON CONFLICT (`id`) DO NOTHING;
--> statement-breakpoint
-- FTS5 trigram untuk pencarian artikel (judul + ringkasan + isi polos).
-- Pola sama pantuns_search_fts (0104): owner_id UNINDEXED, skor bm25.
CREATE VIRTUAL TABLE IF NOT EXISTS `articles_search_fts` USING fts5(
  `text`,
  `owner_id` UNINDEXED,
  tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `articles_search_fts_ai`
AFTER INSERT ON `articles`
WHEN new.status = 'published'
BEGIN
  INSERT INTO articles_search_fts (text, owner_id)
  VALUES (new.title || ' ' || new.excerpt || ' ' || new.body_text, new.id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `articles_search_fts_au`
AFTER UPDATE ON `articles`
BEGIN
  DELETE FROM articles_search_fts WHERE owner_id = new.id;
  INSERT INTO articles_search_fts (text, owner_id)
  SELECT new.title || ' ' || new.excerpt || ' ' || new.body_text, new.id
  WHERE new.status = 'published';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `articles_search_fts_ad`
AFTER DELETE ON `articles`
BEGIN
  DELETE FROM articles_search_fts WHERE owner_id = old.id;
END;
--> statement-breakpoint
-- Backfill artikel published yang sudah ada (idempotent: tabel baru).
INSERT INTO articles_search_fts (text, owner_id)
SELECT a.title || ' ' || a.excerpt || ' ' || a.body_text, a.id
FROM articles a
WHERE a.status = 'published' AND a.deleted_at IS NULL;
