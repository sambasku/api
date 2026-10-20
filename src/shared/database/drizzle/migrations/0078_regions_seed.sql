-- Seed katalog wilayah dari data/regions.json.
-- id = ULID 26 char, deterministik dari slug (timestamp = when migrasi ini).
-- slug = id di regions.json. parent_id = ULID kecamatan induk.
-- Sekali jalan lewat db:migrate. OR IGNORE: aman kalau id yang sama sudah ada.
-- places/users yang masih menyimpan slug di-remap ke ULID regions.id.
ALTER TABLE `regions` ADD `slug` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE UNIQUE INDEX `regions_slug_uidx` ON `regions` (`slug`);
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0YATK69KTSWAFVKFD', 'sambas', 'Sambas', 'kecamatan', NULL, NULL, 1.34636, 109.31004, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0390RTQ3FMP1HKK6K', 'teluk-keramat', 'Teluk Keramat', 'kecamatan', NULL, NULL, 1.47741, 109.20644, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0KXKS6M75PJ8YEQ6M', 'sebawi', 'Sebawi', 'kecamatan', NULL, NULL, 1.27178, 109.24314, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00K5G6G543EVF3NSC', 'sejangkung', 'Sejangkung', 'kecamatan', NULL, NULL, 1.42436, 109.51743, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0NTMRJSHGBMWH2JMC', 'sajad', 'Sajad', 'kecamatan', NULL, NULL, 1.37523, 109.41153, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS067WSK8C1RZ1Y9VV4', 'jawai', 'Jawai', 'kecamatan', NULL, NULL, 1.38467, 109.0839, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS085RXDRYCCW6ZNEDZ', 'jawai-selatan', 'Jawai Selatan', 'kecamatan', NULL, NULL, 1.2516, 109.01747, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0WG94ZVS2MAZHK3KE', 'tebas', 'Tebas', 'kecamatan', NULL, NULL, 1.13519, 109.2057, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0A77KK5GKB14KSVXP', 'tekarang', 'Tekarang', 'kecamatan', NULL, NULL, 1.28685, 109.10514, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0WVVJ1EAWBW9CPA2G', 'pemangkat', 'Pemangkat', 'kecamatan', NULL, NULL, 1.15042, 108.96997, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MPWBHZM33JACHE6P', 'semparuk', 'Semparuk', 'kecamatan', NULL, NULL, 1.1479, 109.06738, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS01PN7Y51KSWMKW68H', 'salatiga', 'Salatiga', 'kecamatan', NULL, NULL, 1.1195, 108.99147, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0WXEFNEGAV6YHEBZ3', 'subah', 'Subah', 'kecamatan', NULL, NULL, 1.19925, 109.44948, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Z9A89658CMVNXW5P', 'selakau', 'Selakau', 'kecamatan', NULL, NULL, 1.05487, 109.01639, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS01C644Q05XNSF9J9G', 'selakau-timur', 'Selakau Timur', 'kecamatan', NULL, NULL, 1.02832, 109.13269, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0W2CMXSS6P9MJ344M', 'galing', 'Galing', 'kecamatan', NULL, NULL, 1.60128, 109.37641, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BW41359EXWCWZ5FA', 'tangaran', 'Tangaran', 'kecamatan', NULL, NULL, 1.54087, 109.16182, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS04C3M3MKAKTH7B84K', 'paloh', 'Paloh', 'kecamatan', NULL, NULL, 1.85241, 109.45327, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS074FJ34F1Z2706Z10', 'sajingan-besar', 'Sajingan Besar', 'kecamatan', NULL, NULL, 1.60426, 109.60148, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS04HEJB7M45TA4B75W', 'selakau/semelagi-besar', 'Semelagi Besar', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0KTQE6C6GSQ7EZH36', 'selakau/sungai-daun', 'Sungai Daun', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Z5VTW27HBDERVPFR', 'selakau/sungai-rusa', 'Sungai Rusa', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0GPHRHJ6FA4ZF3640', 'selakau/pangkalan-bemban', 'Pangkalan Bemban', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BRT4D7QS514YTK3M', 'selakau/sungai-nyirih', 'Sungai Nyirih', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0JJB330QR3HRFCFB7', 'selakau/kuala', 'Kuala', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0RH9CBZA88Q9FHSAA', 'selakau/parit-baru', 'Parit Baru', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07KM0JSYGEE98CXCB', 'selakau/twi-mentibar', 'Twi Mentibar', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS03HBTSGC8VNA7P28M', 'selakau/bentunai', 'Bentunai', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0QHP05YVBM2CPW1S9', 'selakau/parit-kongsi', 'Parit Kongsi', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00156ENGRW9J205K2', 'selakau/gayung-bersambut', 'Gayung Bersambut', 'desa', '01MD5DDYS0Z9A89658CMVNXW5P', '6101010011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0HFYVAADXEV8TMBRZ', 'selakau-timur/gelik', 'Gelik', 'desa', '01MD5DDYS01C644Q05XNSF9J9G', '6101011001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS05M4T3NA4YFHTJ5BJ', 'selakau-timur/seranggam', 'Seranggam', 'desa', '01MD5DDYS01C644Q05XNSF9J9G', '6101011002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS06PT55QJKKHFTTRC0', 'selakau-timur/selakau-tua', 'Selakau Tua', 'desa', '01MD5DDYS01C644Q05XNSF9J9G', '6101011003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BW5C5KRBREX5HSHZ', 'selakau-timur/buduk-sempadang', 'Buduk Sempadang', 'desa', '01MD5DDYS01C644Q05XNSF9J9G', '6101011004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0R39P7TTEZ5SPTR2B', 'pemangkat/perapakan', 'Perapakan', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Q2KJTFTH1CPNPXQD', 'pemangkat/jelutung', 'Jelutung', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0A6R3GTD129ZDWYN5', 'pemangkat/harapan', 'Harapan', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020013', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS02D90V3WD14H683PW', 'pemangkat/penjajap', 'Penjajap', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020014', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0R8ZMVVMRYFBSAFYD', 'pemangkat/pemangkat-kota', 'Pemangkat Kota', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020015', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CSNKMWV2323V361X', 'pemangkat/sebatuan', 'Sebatuan', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020016', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0A8TE4Z3R15N9AN5G', 'pemangkat/gugah-sejahtera', 'Gugah Sejahtera', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020017', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0XNRNH27JGK8VNMFS', 'pemangkat/lonam', 'Lonam', 'desa', '01MD5DDYS0WVVJ1EAWBW9CPA2G', '6101020018', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0QP5CZBN24XHGP7J2', 'semparuk/seburing', 'Seburing', 'desa', '01MD5DDYS0MPWBHZM33JACHE6P', '6101021001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MN5AVH5JR60VQW29', 'semparuk/sepadu', 'Sepadu', 'desa', '01MD5DDYS0MPWBHZM33JACHE6P', '6101021002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0K77T8TJ2S41CSE14', 'semparuk/sepinggan', 'Sepinggan', 'desa', '01MD5DDYS0MPWBHZM33JACHE6P', '6101021003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CWSSDXSC9KKF2J2Y', 'semparuk/semparuk', 'Semparuk', 'desa', '01MD5DDYS0MPWBHZM33JACHE6P', '6101021004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0YAXT36WWGT44T20G', 'semparuk/singaraya', 'Singaraya', 'desa', '01MD5DDYS0MPWBHZM33JACHE6P', '6101021005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0FDZHAKKX4A4Q1VJ0', 'salatiga/parit-baru', 'Parit Baru', 'desa', '01MD5DDYS01PN7Y51KSWMKW68H', '6101022001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0PM51SKG3Y7QSZWBK', 'salatiga/salatiga', 'Salatiga', 'desa', '01MD5DDYS01PN7Y51KSWMKW68H', '6101022002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Y3YV5N6GBN1RFGA3', 'salatiga/sungai-toman', 'Sungai Toman', 'desa', '01MD5DDYS01PN7Y51KSWMKW68H', '6101022003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS048RA67WJM1SM3YF0', 'salatiga/serumpun', 'Serumpun', 'desa', '01MD5DDYS01PN7Y51KSWMKW68H', '6101022004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0QCPNVD1AYW92K208', 'salatiga/serunai', 'Serunai', 'desa', '01MD5DDYS01PN7Y51KSWMKW68H', '6101022005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS09WB7KSCF749R3GH6', 'tebas/seret-ayon', 'Seret Ayon', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0M4AB2K86C781R8KD', 'tebas/maribas', 'Maribas', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS022Y0P784Y46W3PQ2', 'tebas/batu-makjage', 'Batu Makjage', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS08FAX5B368MAHQ55P', 'tebas/bukit-sigoler', 'Bukit Sigoler', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ZE8SVPWGM1D4RQFR', 'tebas/serindang', 'Serindang', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MJGMZTMPDY5ZDA4K', 'tebas/matang-labong', 'Matang Labong', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00G0K56FD5VHJ1KVC', 'tebas/mak-tangguk', 'Mak Tangguk', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0EKZF1SDKCQ2EYCJD', 'tebas/segedong', 'Segedong', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS047N7Q5Z0VV79ADS3', 'tebas/pusaka', 'Pusaka', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS09A6T39QV69Z778QD', 'tebas/mensere', 'Mensere', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DKWSPAWASJT6SKZ7', 'tebas/sungai-kelambu', 'Sungai Kelambu', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0HS6944EWAK825760', 'tebas/serumpun-buluh', 'Serumpun Buluh', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0K7SQ0XGXP38SRJA9', 'tebas/pangkalan-kongsi', 'Pangkalan Kongsi', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030013', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS08DZHGHK8MKQQKAWH', 'tebas/dungun-perapakan', 'Dungun Perapakan', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030014', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DJEDTBE3QADEFPNG', 'tebas/tebas-sungai', 'Tebas Sungai', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030015', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AKP81KBM7BYT5DZ6', 'tebas/sejiram', 'Sejiram', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030016', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0YV60SVJ4G511PQ4Z', 'tebas/seberkat', 'Seberkat', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030017', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0YCJYBZQ1PSF2772J', 'tebas/sempalai', 'Sempalai', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030018', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0PRHCCS83P1G0B2PK', 'tebas/bekut', 'Bekut', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030019', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0JT1H2X7YCRFXSRGQ', 'tebas/mak-rampai', 'Mak Rampai', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030020', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00K599F6CZN6DHJQH', 'tebas/tebas-kuala', 'Tebas Kuala', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030021', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0R27D2X8P3W84J76Y', 'tebas/mekar-sekuntum', 'Mekar Sekuntum', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030022', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0TG1Q3T297TMDSXY5', 'tebas/segarau-parit', 'Segarau Parit', 'desa', '01MD5DDYS0WG94ZVS2MAZHK3KE', '6101030023', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0GEM643G2QQZBCFYT', 'tekarang/matang-segarau', 'Matang Segarau', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AJDY7QC8R7EJAWNC', 'tekarang/rambayan', 'Rambayan', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0SN9MRS65SNNEDE0B', 'tekarang/sari-makmur', 'Sari Makmur', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DZS8Y69NGQ311R9V', 'tekarang/tekarang', 'Tekarang', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DM1QG8EJAWQSSFXN', 'tekarang/sempadian', 'Sempadian', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0PQTT1Z9RQ0P3C9W2', 'tekarang/cepala', 'Cepala', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0E08G072KR74EH94A', 'tekarang/merubung', 'Merubung', 'desa', '01MD5DDYS0A77KK5GKB14KSVXP', '6101031007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0SFFHCWTF7Y74Y50W', 'sambas/sungai-rambah', 'Sungai Rambah', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040019', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DB32DNADP2QFKNNP', 'sambas/gapura', 'Gapura', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040020', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0PG2RTT2DJ5N4R13G', 'sambas/kartiasa', 'Kartiasa', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040021', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0193VYPWVACEC55DS', 'sambas/saing-rambi', 'Saing Rambi', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040022', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0FNGGKC8PYTX32Z2C', 'sambas/lumbang', 'Lumbang', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040023', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0F0164VXSGT1EYHKQ', 'sambas/durian', 'Durian', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040024', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0M970C01T6W16Z4PR', 'sambas/pasar-melayu', 'Pasar Melayu', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040025', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0WM3EFAAMRZP7VDPS', 'sambas/pendawan', 'Pendawan', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040026', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0X0VZKPQ57YPE3GHW', 'sambas/tanjung-bugis', 'Tanjung Bugis', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040027', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0W4C6V0RR7Y26DHY1', 'sambas/lubuk-dagang', 'Lubuk Dagang', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040028', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS05FCZ6GW3FAY43W6R', 'sambas/dalam-kaum', 'Dalam Kaum', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040029', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS02JKNH9EF3X28E6TP', 'sambas/tanjung-mekar', 'Tanjung Mekar', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040030', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS057K9K5NQP96WPYGS', 'sambas/tumuk-manggis', 'Tumuk Manggis', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040031', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0561XQT5PA0MQN5AA', 'sambas/jagur', 'Jagur', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040032', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ZWE1BN9MT73A0S85', 'sambas/lorong', 'Lorong', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040033', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS09FB8FZWBMVTHVFFQ', 'sambas/sebayan', 'Sebayan', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040034', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS04BN8WJRBTPCXXR79', 'sambas/sumber-harapan', 'Sumber Harapan', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040035', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0XJH37GWQAFH4A24B', 'sambas/semangau', 'Semangau', 'desa', '01MD5DDYS0YATK69KTSWAFVKFD', '6101040040', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BRV4PYKE7KN3D2D9', 'subah/tebuah-elok', 'Tebuah Elok', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0H3Y197ZFHKSHRPQ7', 'subah/mensade', 'Mensade', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS06V9SHNQEGY22G8WK', 'subah/sungai-sapa', 'Sungai Sapa', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Y8R35GPG0GD383SX', 'subah/sempurna', 'Sempurna', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS073A7PWWFMWM7CVCY', 'subah/bukit-mulya', 'Bukit Mulya', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BNFA8DX8RT7PK0CF', 'subah/sungai-deden', 'Sungai Deden', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CRR03P7Q763T5F84', 'subah/sabung', 'Sabung', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MPH4Y7130BXHPZ8D', 'subah/mukti-raharja', 'Mukti Raharja', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0F2A7WYR4MCH62GFX', 'subah/karaban-jaya', 'Karaban Jaya', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0W87HQ99N42GB4ZXC', 'subah/balai-gemuruh', 'Balai Gemuruh', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0HTHMAXDC4ETDX9PD', 'subah/madak', 'Madak', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101041011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AVJAKQG3PVGCJ884', 'subah/arga-pura', 'Arga Pura', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101102012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0308EG49Z4MHMCCXM', 'subah/sapak-hulu-trans', 'Sapak Hulu Trans', 'desa', '01MD5DDYS0WXEFNEGAV6YHEBZ3', '6101102013', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07ZPBZSVTEEYFTR36', 'sebawi/sebawi', 'Sebawi', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0346Y8NZTMZQ6HQ1Q', 'sebawi/sempelai-sebedang', 'Sempelai Sebedang', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS06SGZXTW1PHZN504T', 'sebawi/sepuk-tanjung', 'Sepuk Tanjung', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0KHJP2Q99PPQD1KVS', 'sebawi/sebangun', 'Sebangun', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MDXCPR63YK8QVM38', 'sebawi/tempatan', 'Tempatan', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0JTMGABX9WX69HBJ7', 'sebawi/tebing-batu', 'Tebing Batu', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0978GES5RA7S2GWN9', 'sebawi/rantau-panjang', 'Rantau Panjang', 'desa', '01MD5DDYS0KXKS6M75PJ8YEQ6M', '6101042007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS04B3J6GFAD851WEB6', 'sajad/jirak', 'Jirak', 'desa', '01MD5DDYS0NTMRJSHGBMWH2JMC', '6101043001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS076FNKW3QRZZR5NJN', 'sajad/tengguli', 'Tengguli', 'desa', '01MD5DDYS0NTMRJSHGBMWH2JMC', '6101043002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0HMHNJKRDNVCE7XV6', 'sajad/mekar-jaya', 'Mekar Jaya', 'desa', '01MD5DDYS0NTMRJSHGBMWH2JMC', '6101043003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00GZZ9RQ7W6JQMYSR', 'sajad/beringin', 'Beringin', 'desa', '01MD5DDYS0NTMRJSHGBMWH2JMC', '6101043004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DMEVVDV5D9BVGQKV', 'jawai/dungun-laut', 'Dungun Laut', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0TXJ21N5CG9QNSFA2', 'jawai/sentebang', 'Sentebang', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS02DMJYDV43EQ6QQBM', 'jawai/sungai-nyirih', 'Sungai Nyirih', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0D274G2KW9WTMB1WA', 'jawai/bakau', 'Bakau', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050013', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0718SVDT1FPF6BQ1S', 'jawai/parit-setia', 'Parit Setia', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050014', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS08ANC5ED8QYXM7Y0E', 'jawai/pelimpaan', 'Pelimpaan', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050015', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0GW021XJ1PXRNNWD1', 'jawai/sarang-burung-kuala', 'Sarang Burung Kuala', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050016', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS035PJCYCA23962ZJY', 'jawai/sarang-burung-usrat', 'Sarang Burung Usrat', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050017', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BZ124BWQRBDGSV6C', 'jawai/sarang-burung-kolam', 'Sarang Burung Kolam', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050018', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0XCQT21K36QEBQPDR', 'jawai/sungai-nilam', 'Sungai Nilam', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050019', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0NZBYD6TCW5HQNTGV', 'jawai/sarang-burung-danau', 'Sarang Burung Danau', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050020', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0B6ET6RBN0B86YM3R', 'jawai/lambau', 'Lambau', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050021', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0G363A5MBNC13602K', 'jawai/mutus-darussalam', 'Mutus Darussalam', 'desa', '01MD5DDYS067WSK8C1RZ1Y9VV4', '6101050022', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00Z96W2TX2ZFNGBZ5', 'jawai-selatan/jawai-laut', 'Jawai Laut', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS081C4MP4CF6T7GYX7', 'jawai-selatan/jelu-air', 'Jelu Air', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BYR39Q99D4CXKDFZ', 'jawai-selatan/sarilaba-b', 'Sarilaba B', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0N1TJBA93453Y1110', 'jawai-selatan/semperiuk-b', 'Semperiuk B', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS046Y0PE6Q8ET1RNEB', 'jawai-selatan/sabaran', 'Sabaran', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0M6GV62X7BW2WV67P', 'jawai-selatan/semperiuk-a', 'Semperiuk A', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0GZ6BNVC3CWC1KD8Q', 'jawai-selatan/sarilaba-a', 'Sarilaba A', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS02V27PCFNB87RAZMJ', 'jawai-selatan/matang-terap', 'Matang Terap', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AAKE4JSTG9MA0SR9', 'jawai-selatan/suah-api', 'Suah Api', 'desa', '01MD5DDYS085RXDRYCCW6ZNEDZ', '6101051009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0EF5SSS9XBTSKT31T', 'teluk-keramat/teluk-kaseh', 'Teluk Kaseh', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0365X6HJ5AW531NW6', 'teluk-keramat/sengawang', 'Sengawang', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS089E2X85KVXX3GKJ9', 'teluk-keramat/sungai-baru', 'Sungai Baru', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ESNZ2J3Q80WR6109', 'teluk-keramat/berlimang', 'Berlimang', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0NBHFV8MHTHN8NMZZ', 'teluk-keramat/puringan', 'Puringan', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0MBVJSC8PZ6R5HDYB', 'teluk-keramat/kubangga', 'Kubangga', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00DV039KAD79TZSAQ', 'teluk-keramat/tambatan', 'Tambatan', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0SE41D3XN1WD8EANT', 'teluk-keramat/lela', 'Lela', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07V2QJ5EFVJZZTCJ2', 'teluk-keramat/sungai-kumpai', 'Sungai Kumpai', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CMHR95Y14BZXR6YJ', 'teluk-keramat/sekura', 'Sekura', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0JMJMK3JJVMG3Q3A5', 'teluk-keramat/sepadu', 'Sepadu', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS02SC8TXKEBCW4NQT5', 'teluk-keramat/tanjung-keracut', 'Tanjung Keracut', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00CRP8VBHF2TEW7J0', 'teluk-keramat/sebagu', 'Sebagu', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060013', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0N66RP2RWJ4CVX6XX', 'teluk-keramat/kuala-pangkalan-keramat', 'Kuala Pangkalan Keramat', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060019', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS04QJ2Y0K1DY64D2DZ', 'teluk-keramat/mekar-sekuntum', 'Mekar Sekuntum', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060020', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Z8R3YXP2S6DQ72SG', 'teluk-keramat/teluk-kembang', 'Teluk Kembang', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060021', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0P8XTYWB5H6YXRC8G', 'teluk-keramat/sungai-serabek', 'Sungai Serabek', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060022', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0479N8JZZ08GQM6XN', 'teluk-keramat/pedada', 'Pedada', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060023', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07949FXAZJEVBCSKJ', 'teluk-keramat/tri-mandayan', 'Tri Mandayan', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060024', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0P2J67V2EN73J9X4P', 'teluk-keramat/sayang-sedayu', 'Sayang Sedayu', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060025', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07SVW05JV8830QYJ8', 'teluk-keramat/samustida', 'Samustida', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060026', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CFTC3WVAK8B70DMJ', 'teluk-keramat/pipit-teja', 'Pipit Teja', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060027', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0VFENAG6HSDZA01J5', 'teluk-keramat/mulia', 'Mulia', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060035', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS00SCXGKJJ8DNN1C1V', 'teluk-keramat/matang-segantar', 'Matang Segantar', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060036', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0CT693QMKFX2N62HS', 'teluk-keramat/sabing', 'Sabing', 'desa', '01MD5DDYS0390RTQ3FMP1HKK6K', '6101060037', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS017VKB3P6KYJCVTTR', 'galing/ratu-sepudak', 'Ratu Sepudak', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS06DW7KAMZJ9TRQVDD', 'galing/sungai-palah', 'Sungai Palah', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0GZCNZWSTPP4M6PFB', 'galing/sagu', 'Sagu', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0E3CJGRXPHCS0H21R', 'galing/tempapan-kuala', 'Tempapan Kuala', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0H5S1SV760D7Y9RF6', 'galing/galing', 'Galing', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AHRRVKVRSEKBZ7DP', 'galing/tempapan-hulu', 'Tempapan Hulu', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Q64KQQS27B7ER5YP', 'galing/tri-kembang', 'Tri Kembang', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Z8BABAYSRDH4F1GT', 'galing/tri-gadu', 'Tri Gadu', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0WBYQAN5DCQREZ3JC', 'galing/sijang', 'Sijang', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0F2H9W0BM6BRK4RDW', 'galing/teluk-pandan', 'Teluk Pandan', 'desa', '01MD5DDYS0W2CMXSS6P9MJ344M', '6101061010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0XSXWDXCGEVZCZBVN', 'tangaran/semata', 'Semata', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DVMMBWH62ATTVJ11', 'tangaran/tangaran', 'Tangaran', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BSBSZR26C0TVHG83', 'tangaran/merpati', 'Merpati', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS070ZK53GDT02V731R', 'tangaran/simpang-empat', 'Simpang Empat', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0AMNNSPZWSC3D6SFA', 'tangaran/pancur', 'Pancur', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS013K1D94R65Y450HP', 'tangaran/arung-parak', 'Arung Parak', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0K6FZKQK5GH8XAS9V', 'tangaran/merabuan', 'Merabuan', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS09E4FNRP00H14TY65', 'tangaran/arung-medang', 'Arung Medang', 'desa', '01MD5DDYS0BW41359EXWCWZ5FA', '6101062008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS01BSSMA121ENEMMN8', 'sejangkung/sepantai', 'Sepantai', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS090N68TW1N19RZ13G', 'sejangkung/semanga', 'Semanga', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0DM6CAEQACG5KRYPG', 'sejangkung/perigi-limus', 'Perigi Limus', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0R0N5XXM14K0FJ4XR', 'sejangkung/senujuh', 'Senujuh', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0XDWVNSQANJ74EVP3', 'sejangkung/sendoyan', 'Sendoyan', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ABJ8BZCTYXMZ7CJ6', 'sejangkung/perigi-landu', 'Perigi Landu', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0BJ7T1RGHCP09P4GY', 'sejangkung/parit-raja', 'Parit Raja', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0FM5DJ3S4XN238H42', 'sejangkung/piantus', 'Piantus', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS07836QMHAA4VQ6J86', 'sejangkung/sekuduk', 'Sekuduk', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070009', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ZPA16FYPY7KNJM24', 'sejangkung/setalik', 'Setalik', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070010', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS01D9PG2472SES4FYN', 'sejangkung/sulung', 'Sulung', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070011', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0NXYJ9RWQRR39DECH', 'sejangkung/penakalan', 'Penakalan', 'desa', '01MD5DDYS00K5G6G543EVF3NSC', '6101070012', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS05BA7KT9DSD8J39ZR', 'sajingan-besar/sebunga', 'Sebunga', 'desa', '01MD5DDYS074FJ34F1Z2706Z10', '6101080001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0HEEHGMWJGXDGJJ5Q', 'sajingan-besar/kaliau', 'Kaliau', 'desa', '01MD5DDYS074FJ34F1Z2706Z10', '6101080002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0J7YTBV7598G2E56K', 'sajingan-besar/sanatab', 'Sanatab', 'desa', '01MD5DDYS074FJ34F1Z2706Z10', '6101080003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0ZZ6KNHPPFVYD0YTN', 'sajingan-besar/santaban', 'Santaban', 'desa', '01MD5DDYS074FJ34F1Z2706Z10', '6101080004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0KNSMYCDM0Z250R9K', 'sajingan-besar/sungai-bening', 'Sungai Bening', 'desa', '01MD5DDYS074FJ34F1Z2706Z10', '6101080005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0FZMGJ5XNTXSTNASZ', 'paloh/kalimantan', 'Kalimantan', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090001', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0Y2NMCCDDXDFC2JTD', 'paloh/matang-danau', 'Matang Danau', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090002', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0R3F87DBEFS27EWH5', 'paloh/tanah-hitam', 'Tanah Hitam', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090003', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0G51113MAAREJ0VRA', 'paloh/malek', 'Malek', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090004', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0T8D7F394YJMPRARY', 'paloh/nibung', 'Nibung', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090005', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS079MTZZRZ8XFTVAQQ', 'paloh/sebubus', 'Sebubus', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090006', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS0TKTTV4NPBW180YPF', 'paloh/temajuk', 'Temajuk', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090007', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `regions` (`id`, `slug`, `name`, `type`, `parent_id`, `code`, `lat`, `lng`, `status`, `sort_order`, `created_at`) VALUES ('01MD5DDYS08HHTSNS1SEC9M5N1', 'paloh/mentibar', 'Mentibar', 'desa', '01MD5DDYS04C3M3MKAKTH7B84K', '6101090008', NULL, NULL, 'published', 0, unixepoch());
--> statement-breakpoint
UPDATE `places` SET `region_id` = (SELECT `id` FROM `regions` WHERE `regions`.`slug` = `places`.`region_id`) WHERE `region_id` IS NOT NULL AND EXISTS (SELECT 1 FROM `regions` WHERE `regions`.`slug` = `places`.`region_id`);
--> statement-breakpoint
UPDATE `places` SET `village_id` = (SELECT `id` FROM `regions` WHERE `regions`.`slug` = `places`.`village_id`) WHERE `village_id` IS NOT NULL AND EXISTS (SELECT 1 FROM `regions` WHERE `regions`.`slug` = `places`.`village_id`);
--> statement-breakpoint
UPDATE `users` SET `region_id` = (SELECT `id` FROM `regions` WHERE `regions`.`slug` = `users`.`region_id`) WHERE `region_id` IS NOT NULL AND EXISTS (SELECT 1 FROM `regions` WHERE `regions`.`slug` = `users`.`region_id`);
--> statement-breakpoint
UPDATE `users` SET `village_id` = (SELECT `id` FROM `regions` WHERE `regions`.`slug` = `users`.`village_id`) WHERE `village_id` IS NOT NULL AND EXISTS (SELECT 1 FROM `regions` WHERE `regions`.`slug` = `users`.`village_id`);
