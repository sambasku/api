-- Counter pencarian per hari (hit + miss) untuk chart dashboard.
-- day = 'YYYY-MM-DD' WIB; count naik via upsert ON CONFLICT DO UPDATE.
CREATE TABLE `search_daily` (
	`day` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
