-- Seed katalog Place dari data/places.json.
-- id = ULID 26 char (deterministik dari slug). slug tetap URL publik.
-- Sekali jalan lewat db:migrate. OR IGNORE / NOT EXISTS: aman kalau seed-places.ts sudah pernah jalan.
-- type di luar enum (objek-wisata) jadi NULL, sama seperti api/src/scripts/seed-places.ts.
-- short_description kosong di JSON diisi '' karena kolom NOT NULL.
-- related[] tidak di-seed (tidak ada tabel place_related).
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90FDYAGB3RKR2BP164', 'istana-alwatzikoebillah', 'Istana Alwatzikoebillah', 'wisata', 'sejarah', 1.361722806, 109.3130395, 'https://maps.app.goo.gl/2WmeQwzcwDrWaGb56', 'Istana Kesultanan Sambas di Desa Dalam Kaum, dibangun 1933 sampai 1935 pada masa Sultan Muhammad Mulia Ibrahim Syafiuddin.', 'sambas', NULL, NULL, NULL, '[{"name":"Wikipedia - Istana Alwatzikoebillah","type":"web","address":"https://id.wikipedia.org/wiki/Istana_Alwatzikoebillah","license":"CC BY-SA 3.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/3.0/deed.id"},{"name":"SISPARNAS Kemenpar - Istana Alwatzikoebillah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129540","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNF3PF8X86TZJJNNP83', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M400SFRTANSHQ4R6MAAA0VDD.webp', 1, 0, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_Sambas.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNGJNTEYQAF7DPQW1KH', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401P844SWCEM3V60ABYNPCV.webp', 0, 1, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_1.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNGQ0PS3HKEYV6YMXHX', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401P8442T6W6A77HZSAQX5E.webp', 0, 2, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_3.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNG3WEAE1BAFX24V2SG', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401P844B53KD5MBT9B1XDXB.webp', 0, 3, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_5.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNGFP4FWF2HM0E2WJYC', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401P844NVVTAF43WKCZD2YF.webp', 0, 4, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_13.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNG3FDY7XX1QAN7RV73', '01MCKH7D90FDYAGB3RKR2BP164', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401P844KFRGK0A09J5SRJA3.webp', 0, 5, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Istana_Alwatzikoebillah_15.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90FDYAGB3RKR2BP164');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90NA9WXBDF8QZWS6VZ', 'masjid-jami-sultan-muhammad-shafiuddin-ii', 'Masjid Jami Keraton Sambas', 'wisata', 'sejarah', 1.37515, 109.31792, 'https://maps.app.goo.gl/RW2zZF7f3Go3BRi77', 'Masjid Jami Keraton Sambas adalah masjid yang berada di komplek keraton Kesultanan Sambas, Kota Sambas, Kalimantan Barat. Masjid yang resminya bernama Masjid Sultan Muhammad Syafi''oeddin II ini tercatat sebagai masjid tertua di Kalimantan Barat.', 'sambas', NULL, NULL, NULL, '[{"name":"Wikipedia - Masjid Jami Keraton Sambas","type":"web","address":"https://id.wikipedia.org/wiki/Masjid_Jami_Keraton_Sambas","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/deed.id"},{"name":"SISPARNAS Kemenpar - Masjid Jami'' Kesultanan Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26499","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGW2VCYJ1T5X9X74DM', '01MCKH7D90NA9WXBDF8QZWS6VZ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/01M401G8BVETWRG1Q02HA9FFSQ.webp', 1, 0, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Masjid_Jami%27_Sultan_Muhammad_Shafiuddin_II_Sambas.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90NA9WXBDF8QZWS6VZ');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KKCS6CJEZRCD6Y3X', 'waterfront-sambas', 'Waterfront Sambas', 'wisata', NULL, 1.3636572, 109.314685, 'https://maps.app.goo.gl/fRwLy5kg2sRfM3Xk8', 'Kawasan tepi Sungai Sambas yang ditata jadi tempat rekreasi warga. Ada deretan toko, kafe, dan spot foto yang apik. Paling ramai saat sore dan malam, waktu yang pas untuk menikmati pemandangan sungai di tengah kota Sambas.', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Waterfront Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26536","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGCTNXG7KY096HN221', '01MCKH7D90KKCS6CJEZRCD6Y3X', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KKCS6CJEZRCD6Y3X');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90Q4W2NHHPKCH5E7MA', 'makam-kesultanan-sambas-dan-kerabat', 'Makam Kesultanan Sambas dan Kerabat', 'wisata', NULL, 1.37722, 109.31518, 'https://maps.app.goo.gl/M4Yd5VSZz28vB6im7', 'Objek Wisata', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Kesultan Sambas dan Kerabat","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26491","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGM392VZT5TFKJXRYY', '01MCKH7D90Q4W2NHHPKCH5E7MA', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90Q4W2NHHPKCH5E7MA');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KFY9C8GD6HYHA4D1', 'bangunan-kantor-kewedanaan-balairung-sari', 'Bangunan Kantor Kewedanaan Balairung Sari', 'wisata', NULL, 1.365193, 109.297026, 'https://maps.app.goo.gl/mVdQAfjQcgZSJLCy6', 'Objek Wisata', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Bangunan Kantor Kewedanaan Balairung Sari","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37219","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGHEE4YQ7D44FAVN6W', '01MCKH7D90KFY9C8GD6HYHA4D1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KFY9C8GD6HYHA4D1');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905HHJ8B79YTSYA7Z8', 'jembatan-gerattak-asam', 'Jembatan (Gerattak) Asam', 'wisata', NULL, 1.3613897, 109.3081027, 'https://maps.app.goo.gl/zZpKCwGy4xj7QQPx8', 'Objek Wisata', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Jembatan (Gerattak) Asam","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39041","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNG3DWH3X08NNZFMBT8', '01MCKH7D905HHJ8B79YTSYA7Z8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905HHJ8B79YTSYA7Z8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905YD61YHQ3NSD19TQ', 'jembatan-gerattak-batu', 'Jembatan (Gerattak) Batu', 'wisata', NULL, 1.3648001, 109.3004797, 'https://maps.app.goo.gl/pEpBMLYZna5DNRmK6', 'Objek Wisata', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Jembatan (Gerattak) Batu","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39039","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGE4TPAX9C4JC6VRG9', '01MCKH7D905YD61YHQ3NSD19TQ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905YD61YHQ3NSD19TQ');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90TNVEZJNZGY22HM99', 'museum-negeri-sambas', 'Museum Negeri Sambas', 'wisata', NULL, 1.3647247, 109.2968682, 'https://maps.app.goo.gl/bvAwr3D7anKsyoXy8', 'Museum yang menyimpan koleksi sejarah dan budaya Kabupaten Sambas, mulai dari benda peninggalan Kesultanan Sambas, artefak masa prasejarah, sampai hasil budaya suku-suku di Kalimantan Barat. Tempat yang tepat untuk mengenal warisan wilayah perbatasan Indonesia-Malaysia ini.', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Museum Negeri Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/24440","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNG0VJEKAQ0AV7SVMAD', '01MCKH7D90TNVEZJNZGY22HM99', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Museum_Daerah_Sambas_1.webp', 1, 0, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Museum_Daerah_Sambas_1.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNG2DMCS9BJARS0CQD8', '01MCKH7D90TNVEZJNZGY22HM99', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Museum_Daerah_Sambas_6.webp', 0, 1, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Museum_Daerah_Sambas_6.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNG9VR6JBDBB2NGAC2E', '01MCKH7D90TNVEZJNZGY22HM99', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Museum_Daerah_Sambas_7.webp', 0, 2, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Museum_Daerah_Sambas_7.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNGNFB7ARFJWD4SER78', '01MCKH7D90TNVEZJNZGY22HM99', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Museum_Daerah_Sambas_9.webp', 0, 3, '{"name":"Zhilal Darma","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Museum_Daerah_Sambas_9.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90TNVEZJNZGY22HM99');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90WQ2RGM7JY5QEJEWM', 'kampung-tenun-semberang', 'Kampung Tenun Semberang', 'wisata', NULL, 1.380082, 109.3494927, 'https://maps.app.goo.gl/CLm1MxavRiMRhoJi9', 'Kampung pengrajin tenun di Desa Sumber Harapan, Kecamatan Sambas. Di sini pengrajin menenun songket dan tenun ikat dengan motif khas Melayu dan Dayak. Kamu bisa melihat langsung proses menenun dari benang jadi kain, sekaligus membawa pulang kain tenun sebagai oleh-oleh khas Sambas.', 'sambas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Kampung Tenun Semberang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129539","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGKRG363ADYTKTA93A', '01MCKH7D90WQ2RGM7JY5QEJEWM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90WQ2RGM7JY5QEJEWM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90NHKKCB4X0C56YXJX', 'markas-polisi-belanda', 'Markas Polisi Belanda', 'wisata', NULL, 1.17619106, 108.97035502, 'https://maps.app.goo.gl/rzcBrfThWM5NvB1DA', 'Objek Wisata', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Markas  Polisi Belanda","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37213","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNGSYKJVD7489MW7N96', '01MCKH7D90NHKKCB4X0C56YXJX', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90NHKKCB4X0C56YXJX');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90J45AP7AHPYG2716X', 'rumah-tahanan-belanda', 'Rumah Tahanan Belanda', 'wisata', NULL, 1.1799875, 108.9694219, 'https://maps.app.goo.gl/3Dc2vGFjteD4c4j77', 'Objek Wisata', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Rumah Tahanan Belanda","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37203","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHXEHS8VQEP92A8XFD', '01MCKH7D90J45AP7AHPYG2716X', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90J45AP7AHPYG2716X');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90FYE9P1V5X7Q1WCAM', 'makam-fj-sorg', 'Makam F.J Sorg', 'wisata', NULL, 1.1755598, 108.9762849, 'https://maps.app.goo.gl/E7CFq9n2PN8wXceH6', 'Makam bersejarah di tengah Kota Pemangkat, peristirahatan terakhir F.J. Sorg, tokoh yang tercatat dalam sejarah kolonial di Kalimantan Barat. Situs ini mengingatkan pada masa lalu Pemangkat yang pernah jadi pusat pemerintahan penting di pesisir Sambas.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam F.J Sorg","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37224","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHSX7QBMMZ9AY6VRJY', '01MCKH7D90FYE9P1V5X7Q1WCAM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90FYE9P1V5X7Q1WCAM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90B8TZ7BDFP65E66PF', 'benteng-peninggalan-belanda', 'Benteng Peninggalan Belanda', 'wisata', NULL, 1.15534701864, 108.9482983172, 'https://maps.app.goo.gl/Ctwitz1SRefnpFGy9', 'Sisa bangunan benteng Belanda di pusat Kota Pemangkat, bukti kehadiran kolonial di pesisir Sambas pada abad ke-18 dan ke-19. Bangunan batu dengan fondasi kokoh masih berdiri, jadi pengingat masa lalu wilayah ini. Lokasinya dekat dengan pusat kota.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Benteng Peninggalan Belanda","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37231","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHBB8AJP10VME1GRDA', '01MCKH7D90B8TZ7BDFP65E66PF', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90B8TZ7BDFP65E66PF');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90QBBY5AZSMS0S7P2T', 'sumur-peninggalan-belanda', 'Sumur Peninggalan Belanda', 'wisata', NULL, 1.3589274, 109.3156144, 'https://maps.app.goo.gl/mepsoqQ6GVpedTn99', 'Objek Wisata', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHPD2YSC933P35HZPB', '01MCKH7D90QBBY5AZSMS0S7P2T', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90QBBY5AZSMS0S7P2T');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90YAQ3NVD7MEDFRYAR', 'tugu-fasisme', 'Tugu Peringatan Perang', 'wisata', NULL, 1.1799759, 108.9694348, 'https://maps.app.goo.gl/L6c3K75AqNwdEkVd8', 'Tugu peringatan perang yang terletak di Pemangkat, Kabupaten Sambas, Kalimantan Barat.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Tugu Fasisme","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37237","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHXTDD5KR5DDD5S23K', '01MCKH7D90YAQ3NVD7MEDFRYAR', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90YAQ3NVD7MEDFRYAR');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90PVRW6QA50QA5BF89', 'pantai-tanjung-batu', 'Pantai Tanjung Batu', 'wisata', NULL, 1.157062631, 108.979536, 'https://maps.app.goo.gl/CZz6HChfqfyeqM1B9', 'Pantai di Desa Pemangkat Kota, Kecamatan Pemangkat, dengan hamparan pasir yang landai dan air laut yang tenang. Tempat yang pas untuk jalan santai di tepi pantai sambil menunggu matahari terbenam. Aksesnya dekat dari jalan utama Sambas-Pemangkat.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Tanjung Batu","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39036","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNH5EMCN5834X5KFTBQ', '01MCKH7D90PVRW6QA50QA5BF89', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90PVRW6QA50QA5BF89');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90S37T7N1W8Y0ZJB9R', 'pantai-sinam', 'Pantai Sinam', 'wisata', NULL, 1.1753799, 108.9706002, 'https://maps.app.goo.gl/2uLRo62bhS7yJm2V8', 'Pantai di Desa Sinam, Kecamatan Pemangkat, dengan pasir yang agak gelap akibat endapan lumpur dari sungai-sungai kecil di dekatnya. Ombaknya sedang, cocok untuk melihat dinamika laut Kalimantan Barat. Di bagian belakang pantai tumbuh mangrove yang menambah hijau suasana.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Sinam","type":"web","address":"https://sisparnas.kemenpar.go.id/p/134071","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHHWM4Z5Z96GW4NKN3', '01MCKH7D90S37T7N1W8Y0ZJB9R', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90S37T7N1W8Y0ZJB9R');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90E248G015TSN1SGNH', 'toa-pekong-ular-putih', 'Toa Pekong Ular Putih', 'wisata', NULL, 1.1526958, 108.9683729, 'https://maps.app.goo.gl/3LHj1QKzdMVTSw2n6', 'Kuil Tionghoa di tengah Kota Pemangkat, tempat ibadah sekaligus bukti budaya masyarakat Tionghoa-Melayu yang sudah lama hidup berdampingan. Arsitekturnya khas Tionghoa dengan atap melengkung, ukiran naga, dan arca ular putih di dalannya.', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Toa Pekong Ular Putih","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26555","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHM2HQE4DTTV9DJ0AY', '01MCKH7D90E248G015TSN1SGNH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90E248G015TSN1SGNH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905D7YQVDN7SKQ3FBV', 'toa-pekong-dewi-kwan-im', 'Toa Pekong Dewi Kwan Im', 'wisata', NULL, 1.1298789, 108.9682563, 'https://maps.app.goo.gl/6Z2q6QUaqh8cvs69A', 'Objek Wisata', 'pemangkat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Toa Pekong Dewi Kwan Im","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26545","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHGR9A624WVZDWYHH7', '01MCKH7D905D7YQVDN7SKQ3FBV', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905D7YQVDN7SKQ3FBV');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D900QA972EG692QYVWM', 'taman-istana-putri-danau-sebedang', 'Taman Istana Putri Danau Sebedang', 'wisata', NULL, 1.2612873567, 109.176594135, 'https://maps.app.goo.gl/o7q6pwHkM79QrZqC9', 'Objek Wisata', 'sebawi', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Taman Lunggi Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39033","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHNHHAGSHS0M2ES02V', '01MCKH7D900QA972EG692QYVWM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D900QA972EG692QYVWM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90T3YRWBSGYBDBJ78H', 'danau-sebedang', 'Danau Sebedang', 'wisata', NULL, 1.2577544, 109.1952949, 'https://maps.app.goo.gl/PFUyEVXLdFDvuV3R8', 'Danau di Desa Sempelai, Kecamatan Sebawi, dikelilingi hutan dan hamparan sawah. Airnya jadi sumber kehidupan warga sekitar sekaligus tempat rekreasi alam. Suasana tenang dan hijau membuatnya cocok untuk bersantai sambil menikmati desa Kalimantan Barat.', 'sebawi', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Wisata Danau Sebedang","type":"web","address":"https://jadesta.kemenpar.go.id/desa/danau_sebedang","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Danau Sebedang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129033","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHM5EG80CJCKCE5X93', '01MCKH7D90T3YRWBSGYBDBJ78H', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNHKB5GMCBBSVPFKMY2', '01MCKH7D90T3YRWBSGYBDBJ78H', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/danau_sebedang_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/98303.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90T3YRWBSGYBDBJ78H');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90G054SCV91H68TME5', 'makam-bujang-nadi-dare-nandung', 'Makam Bujang Nadi Dare Nandung', 'wisata', NULL, 1.2631263, 109.179506, 'https://maps.app.goo.gl/cRKxmiueL6UzGQYUA', 'Objek Wisata', 'sebawi', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Bujang Nadi Dare Nandung","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26511","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHF6H86Q1DTRTENQN0', '01MCKH7D90G054SCV91H68TME5', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90G054SCV91H68TME5');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9090FYFKJ5374629SG', 'surau-peninggalan-raden-sulaiman', 'Surau Peninggalan Raden Sulaiman', 'wisata', NULL, 1.2896135, 109.1748561, 'https://maps.app.goo.gl/vyfoMgZHHDkMJ4Zz7', 'Objek Wisata', 'sebawi', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Surau Peninggalan Raden Sulaiman","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26524","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHZ7GWBBB2AX3Z79NT', '01MCKH7D9090FYFKJ5374629SG', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9090FYFKJ5374629SG');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90XQ4ZZKXMA7A49HW3', 'pantai-tanjung-lestari', 'Pantai Tanjung Lestari', 'wisata', NULL, 1.6326494, 109.2217426, 'https://maps.app.goo.gl/epsVQjEKcxQ4itpF9', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Tanjung Lestari Paloh","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27882","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHXAN5PEXZANYHBKFE', '01MCKH7D90XQ4ZZKXMA7A49HW3', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90XQ4ZZKXMA7A49HW3');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D902QJC511GN4F5QN3S', 'pantai-harapan', 'Pantai Harapan', 'wisata', NULL, 1.6498106, 109.2430236, 'https://maps.app.goo.gl/NoJ1ptGd2ZsEkEqy7', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Harapan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27884","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHNCDRRF3DNR7X1QMH', '01MCKH7D902QJC511GN4F5QN3S', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D902QJC511GN4F5QN3S');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90WGK3DCPCK7EEHPCS', 'pantai-pulau-selimpai', 'Pantai Pulau Selimpai', 'wisata', NULL, 1.7847358, 109.296512, 'https://maps.app.goo.gl/Fd9FjaEAPQwgpzU87', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Pulau Selimpai","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27885","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHXF4DY57N3E9ZBR9N', '01MCKH7D90WGK3DCPCK7EEHPCS', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Pantai_Selimpai_Kampak.webp', 1, 0, '{"name":"Cerevisae","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Pantai_Selimpai_and_Pantai_Kampak_Indah_in_West_Kalimantan,_Indonesian_Borneo.jpg","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90WGK3DCPCK7EEHPCS');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9021DBN7ZD7DJ1XJBA', 'pantai-kampak-indah', 'Pantai Kampak Indah', 'wisata', NULL, 1.96017178783, 109.350546466, 'https://maps.app.goo.gl/zKpZ8xB4Wwp2JbJg7', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Kampak Indah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27886","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHETA05TWBJDFCJD2C', '01MCKH7D9021DBN7ZD7DJ1XJBA', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9021DBN7ZD7DJ1XJBA');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9031NGB9M6KB96YYF5', 'pantai-camar-bulan', 'Pantai Camar Bulan', 'wisata', NULL, 1.992341189708762, 109.58931838195315, 'https://maps.app.goo.gl/mtyr1UQSzEVSE1FT9', 'Pantai berpasir putih di Desa Temajuk, Kecamatan Paloh, titik paling barat Kalimantan yang berbatasan langsung dengan Sarawak, Malaysia. Dinamai Camar Bulan karena sering didatangi burung camar, terutama saat musim burung migran. Pemandangannya luas, langit membentang, ombak khas pantai barat Kalimantan.', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Atraksi Pantai Camar Bulan","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_camar_bulan","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Camar Bulan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53106","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Camar Bulan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129065","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNH7KDGZJS67V62Y407', '01MCKH7D9031NGB9M6KB96YYF5', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Sunset_Camar_Bulan.webp', 1, 0, '{"name":"Fikri Irawan Asnawi","provider":"wikimedia","url":"https://commons.wikimedia.org/wiki/File:Sunset_Camar_Bulan.jpg","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}'
  UNION ALL
  SELECT '01M5AJGGNHZ5V52QJRJRS17FV6', '01MCKH7D9031NGB9M6KB96YYF5', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Pantai_Camar_Bulan_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.com/imgpost/33622.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9031NGB9M6KB96YYF5');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905KMZVRG4DMQ4R0AM', 'pantai-tanjung-bendera', 'Pantai Tanjung Bendera', 'wisata', NULL, 1.9423508, 109.3381533, 'https://maps.app.goo.gl/CZz6HChfqfyeqM1B9', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNH7E67HRTZZAC87GBT', '01MCKH7D905KMZVRG4DMQ4R0AM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905KMZVRG4DMQ4R0AM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90113P4YDFE4X720VB', 'pantai-tanjung-kemuning', 'Pantai Tanjung Kemuning', 'wisata', NULL, 1.181607, 108.9693382, NULL, 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Pantai Tanjung Kemuning","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_tanjung_kemuning_1","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHF3YST3PCZ9ZXC5MW', '01MCKH7D90113P4YDFE4X720VB', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNH6PDFW45J2XYS3T4C', '01MCKH7D90113P4YDFE4X720VB', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_tanjung_kemuning_1_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/59425.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90113P4YDFE4X720VB');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90XQWHSC1FN5BN5FZP', 'pantai-banyuan', 'Pantai Banyuan', 'wisata', NULL, 1.6318345, 109.2219144, 'https://maps.app.goo.gl/nVeLjnRGn9zuTt9i9', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Banyuan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39031","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNH57856QS2YKNA2PN7', '01MCKH7D90XQWHSC1FN5BN5FZP', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90XQWHSC1FN5BN5FZP');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90G7F7BY1NNWZT2KPP', 'dermaga-asam-jawe', 'Dermaga Asam Jawe', 'wisata', NULL, 1.8306473, 109.3703083, 'https://maps.app.goo.gl/Rd9EfD7KMuD13LsP6', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Dermaga Asam Jawe","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39023","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHRBX096543X1108JQ', '01MCKH7D90G7F7BY1NNWZT2KPP', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90G7F7BY1NNWZT2KPP');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D900ZQSR8NPKSWGMPE8', 'pantai-telok-atong-bahari', 'Pantai Telok Atong Bahari', 'wisata', NULL, 2.043977297829329, 109.61517145824173, 'https://maps.app.goo.gl/bRbXodzyYRNr7F3J6', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Pantai Teluk Atong","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_teluk_atong","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Teluk Atong","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129026","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNH36R8DQSJC6Z7H8K6', '01MCKH7D900ZQSR8NPKSWGMPE8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNHF9E24REVXM3GBTSR', '01MCKH7D900ZQSR8NPKSWGMPE8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_teluk_atong_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/35189.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D900ZQSR8NPKSWGMPE8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KCW4KN6702CQA6S1', 'pantai-batu-pipih', 'Pantai Batu Pipih', 'wisata', NULL, 1.9383707, 109.3420023, 'https://maps.app.goo.gl/SiQv5X6CbQ964yUi6', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Batu Pipih","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39022","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHN0THP7X78QQH66Y9', '01MCKH7D90KCW4KN6702CQA6S1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KCW4KN6702CQA6S1');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90844FETBG1MK51867', 'pantai-kalimantan', 'Pantai Kalimantan', 'wisata', NULL, 1.84966189, 109.4002856, 'https://maps.app.goo.gl/fmRL6GcgD2mS3NsY9', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Kalimantan Paloh","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39018","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHM21X4X38JSVTHH4T', '01MCKH7D90844FETBG1MK51867', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90844FETBG1MK51867');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90RJY0P284TKQEZJT5', 'pantai-teluk-cemara-guntung', 'Pantai Teluk Cemara Guntung', 'wisata', NULL, 1.908681642, 109.3824329, 'https://maps.app.goo.gl/hux1N8qLjeCNT2T5A', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Teluk Cemara Guntung","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39017","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHNA9CWRMA4B837YZ4', '01MCKH7D90RJY0P284TKQEZJT5', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90RJY0P284TKQEZJT5');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90B04T4ZFMY30VNTDM', 'hutan-hujan-tropis-tanjung-dato-di-temajuk', 'Hutan Hujan Tropis Tanjung Dato di Temajuk', 'wisata', NULL, 1.9823587, 109.5497303, 'https://maps.app.goo.gl/HvptwTpA1ardxroB9', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Tanjung Dato","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/tanjung_dato","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Hutan Hujan Tropis Tanjung Dato di Temajuk","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39016","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNHD1H8DDVYSZVMG9DJ', '01MCKH7D90B04T4ZFMY30VNTDM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJWR3WZC24785RY954', '01MCKH7D90B04T4ZFMY30VNTDM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/tanjung_dato_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/35210.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90B04T4ZFMY30VNTDM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90B8PH14S5X25AZAGB', 'air-terjun-teluk-nibung', 'Air terjun Teluk Nibung', 'wisata', NULL, 1.87436807604, 109.40715215236, NULL, 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Air terjun Teluk Nibung","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39015","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ0465M12QFBK7XRND', '01MCKH7D90B8PH14S5X25AZAGB', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90B8PH14S5X25AZAGB');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D908R7KDTFJW3D3H9RW', 'air-terjun-gunung-pangi', 'Air terjun Gunung Pangi', 'wisata', NULL, 1.9918032, 109.6032325, NULL, 'Objek WIsata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Air terjun Gunung Pangi","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39014","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJR5GJVJRYJJHA7PBP', '01MCKH7D908R7KDTFJW3D3H9RW', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D908R7KDTFJW3D3H9RW');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90455XHZ5CNQ2SKG30', 'twa-sungai-liku', 'TWA Sungai Liku', 'wisata', NULL, 1.7433012, 109.3164602, 'https://maps.app.goo.gl/WmJMKxk5sQj2VXwv7', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Taman Wisata Alam Sungai Liku","type":"web","address":"https://sisparnas.kemenpar.go.id/p/36190","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJEZFZFQFXXCGM8QXK', '01MCKH7D90455XHZ5CNQ2SKG30', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90455XHZ5CNQ2SKG30');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90C7SSDVZ8MSPVKQA6', 'twa-gunung-melintang', 'TWA Gunung Melintang', 'wisata', NULL, 1.719199085, 109.5791482, NULL, 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - TWA Gunung Melintang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32604","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJM6R7AXP3P86H8525', '01MCKH7D90C7SSDVZ8MSPVKQA6', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90C7SSDVZ8MSPVKQA6');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90Y1Q0R9CT59RJA154', 'twa-asuansang', 'TWA Asuansang', 'wisata', NULL, 1.8299018, 109.4558617, 'https://maps.app.goo.gl/eaw1rnK5kdppyrjYA', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - TWA Asuansang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/36187","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJHDDHSYB5WEZSSEPE', '01MCKH7D90Y1Q0R9CT59RJA154', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90Y1Q0R9CT59RJA154');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90ADYWK2F8V8F48DD1', 'twa-tanjung-belimbing', 'TWA Tanjung Belimbing', 'wisata', NULL, 1.795456411, 109.30944862, 'https://maps.app.goo.gl/KqMyiGES3geEr3PbA', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Twa Tanjung Belimbing - Pantai Selimpai","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/twa_tanjung_belimbing__pantai_selimpai","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Taman Wisata Alam Tanjung Belimbing","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32678","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJE1C3BACJYXPY0X1A', '01MCKH7D90ADYWK2F8V8F48DD1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJ6C8Q902W8C4SSQPJ', '01MCKH7D90ADYWK2F8V8F48DD1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/twa_tanjung_belimbing__pantai_selimpai_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/59397.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90ADYWK2F8V8F48DD1');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9093XW9AHRQRX5DSG2', 'taman-rekreasi-batu-bejamban', 'Taman Rekreasi Batu Bejamban', 'wisata', NULL, 1.8769757833, 109.450007107, 'https://maps.app.goo.gl/HSeViVRkB8rCRvfT7', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Misteri Batu Bejamban","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/misteri_batu_bejamban","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Batu  Bejamban","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37197","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJCDFDHRX09G9D3GNB', '01MCKH7D9093XW9AHRQRX5DSG2', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJX64W1SRXVR786SE2', '01MCKH7D9093XW9AHRQRX5DSG2', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/misteri_batu_bejamban_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/52153.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9093XW9AHRQRX5DSG2');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KBP3CTRK7QK24EVJ', 'pantai-rindu-samudera', 'Pantai Rindu Samudera', 'wisata', NULL, 1.9040912, 109.331257, 'https://maps.app.goo.gl/NxtF4LPyAFvbjRky8', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Pantai Kampak - Rindu Samudra","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_kampak__rindu_samudra","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Rindu Samudera","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32666","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJTW7956KWX9A44249', '01MCKH7D90KBP3CTRK7QK24EVJ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJ1C2NK61VRVZC6XZZ', '01MCKH7D90KBP3CTRK7QK24EVJ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_kampak__rindu_samudra_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/59400.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KBP3CTRK7QK24EVJ');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90S8CNN75QTSA7W352', 'pantai-tanjung-api', 'Pantai Tanjung Api', 'wisata', NULL, 1.8275625, 109.3704375, 'https://maps.app.goo.gl/Aojkry6jyATzR3NZ9', 'Objek Wisata', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - DTW Tanjung Api","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/dtw_tanjung_api","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Tanjung Api","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129533","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ24RJ6YB1MZTC2ZQE', '01MCKH7D90S8CNN75QTSA7W352', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJT21GB48S2BYXVN49', '01MCKH7D90S8CNN75QTSA7W352', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/dtw_tanjung_api_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/52069.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90S8CNN75QTSA7W352');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D902DPH0DEZFYWY210Y', 'taman-wisata-mangrove-sebubus', 'Taman Wisata Mangrove Sebubus', 'wisata', NULL, 1.7835380245618957, 109.33488484883115, 'https://maps.app.goo.gl/xczqJ5V7nWUtPpyH8', 'Objek Wisata', 'paloh', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Ekowisata Mangrove Sebubus","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53308","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Taman Wisata Mangrove Sebubus","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129534","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJP2M6ZM38YEJBXPTF', '01MCKH7D902DPH0DEZFYWY210Y', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D902DPH0DEZFYWY210Y');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90NTDEC4FKTF65Z9F4', 'pantai-kahona', 'Pantai Kahona', 'wisata', NULL, 1.464816, 109.0384929, 'https://maps.app.goo.gl/wXEq4avHyW7SZxQ6A', 'Objek WIsata', 'jawai', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Kahona","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32668","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJM9FYRH9TPGFVXEJ3', '01MCKH7D90NTDEC4FKTF65Z9F4', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90NTDEC4FKTF65Z9F4');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90T254Y6F1WA1WQJFS', 'pantai-natuna-indah', 'Pantai Natuna Indah', 'wisata', NULL, 1.3194005, 109.0287451, 'https://maps.app.goo.gl/J2RUHnyztQ6fptxp7', 'Objek Wisata', 'jawai', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Natuna Indah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/38774","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJE7DHMG0KS20KYEJF', '01MCKH7D90T254Y6F1WA1WQJFS', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90T254Y6F1WA1WQJFS');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D909THMDG20QVD3PGS8', 'pantai-datok-buntar', 'Pantai Datok Buntar', 'wisata', NULL, 1.3141809, 109.0253069, 'https://maps.app.goo.gl/y9p4VrFvgDizJhZG8', 'Objek Wisata', 'jawai', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Datok Buntar","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37157","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJJ5D2DGG0945N1KS9', '01MCKH7D909THMDG20QVD3PGS8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/Pantai_Datok_Buntar_SISPARNAS.webp', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/37157","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D909THMDG20QVD3PGS8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90QT9VRV7M3KR7E0CG', 'pantai-polaria', 'Pantai Polaria', 'wisata', NULL, 1.0349875, 108.9692969, 'https://maps.app.goo.gl/M9ivjrhF4bhaXkrD7', 'Objek WIsata', 'selakau', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Polaria","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32671","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ5RYYVKRCB3CXRPNZ', '01MCKH7D90QT9VRV7M3KR7E0CG', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90QT9VRV7M3KR7E0CG');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D909HQWXDJR1PYHFSNR', 'pantai-saaditerigas', 'Pantai Saadi/Terigas', 'wisata', NULL, 1.3138131, 109.0047323, NULL, 'Objek Wisata', 'selakau', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Saadi/Terigas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/38773","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJHCB78F459MTCH35N', '01MCKH7D909HQWXDJR1PYHFSNR', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D909HQWXDJR1PYHFSNR');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90E6V6XRNDMXFVJ3QM', 'makam-ratu-anom-kesuma-yuda', 'Makam Ratu Anom Kesuma Yuda', 'wisata', NULL, 1.0696816063, 108.99979462, NULL, 'Objek WIsata', 'selakau', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Ratu Anom Kesuma Yuda","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37244","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJGQ1EW137NT1ADA8M', '01MCKH7D90E6V6XRNDMXFVJ3QM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90E6V6XRNDMXFVJ3QM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90CJZYSAMC53N7E2HP', 'makam-pangeran-timba-bayi', 'Makam Pangeran Timba’ Bayi', 'wisata', NULL, 1.05723401, 108.968669, NULL, 'Objek WIsata', 'selakau', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Pangeran Timba’ Bayi","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37247","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJYAH49TGC5G1RF6VP', '01MCKH7D90CJZYSAMC53N7E2HP', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90CJZYSAMC53N7E2HP');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90PZJY8AG0V7N1KC4W', 'pantai-muare-jalan-indah', 'Pantai Muare Jalan Indah', 'wisata', NULL, 1.6037961, 109.1631238, NULL, 'Objek WIsata', 'tangaran', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Muare Jalan Indah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/38777","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ53PD53XPC6P6KQFA', '01MCKH7D90PZJY8AG0V7N1KC4W', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90PZJY8AG0V7N1KC4W');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90ASJFE46T8C8KJ2F8', 'pantai-dataran-merdeka', 'Pantai Dataran Merdeka', 'wisata', NULL, 1.540573, 109.1128496, 'https://maps.app.goo.gl/k9vdXN4MB69gnZbN6', 'Objek Wisata', 'tangaran', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Dataran Merdeka","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39009","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ6B2V1TACTG9M0R3Y', '01MCKH7D90ASJFE46T8C8KJ2F8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90ASJFE46T8C8KJ2F8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90VJVTTXA8G903C2TK', 'pantai-tanjung-terabitan', 'Pantai Tanjung Terabitan', 'wisata', NULL, 1.5488098212, 109.111476364, NULL, 'Objek Wisata', 'tangaran', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Pantai Tanjung Terabitan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39008","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJH113V24DV6ENTY4D', '01MCKH7D90VJVTTXA8G903C2TK', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90VJVTTXA8G903C2TK');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D901HMS1KH8Y9FH3B4X', 'pantai-venesia', 'Pantai Venesia', 'wisata', NULL, 1.5305057, 109.0661569, 'https://maps.app.goo.gl/zRMutrSJLE19VjX86', 'Objek WIsata', 'tangaran', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ2BTSDPB5JQKH44EE', '01MCKH7D901HMS1KH8Y9FH3B4X', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D901HMS1KH8Y9FH3B4X');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90NF19A0ZK5FKDF2B4', 'makamsyech-muhammad-sattaruddin', 'MakamSyech Muhammad Sattaruddin', 'wisata', NULL, 1.0579125, 108.9754219, 'https://maps.app.goo.gl/tQ3WB2eSBbsZxkQW7', 'Objek Wisata', 'galing', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - MakamSyech Muhammad Sattaruddin","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37253","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ19R3GPVG3RN9W2PF', '01MCKH7D90NF19A0ZK5FKDF2B4', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90NF19A0ZK5FKDF2B4');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90MWV196MAGPKVRHEG', 'makam-dato-timalar-tan-azis-bujang', 'Makam Dato’ Timalar Tan Azis Bujang', 'wisata', NULL, 1.59338208616, 109.32232359, NULL, 'Objek Wisata', 'galing', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Dato Timalar Aziz Bujang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37256","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJNXXTRDK77S1J0Y5N', '01MCKH7D90MWV196MAGPKVRHEG', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90MWV196MAGPKVRHEG');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90V1RJHGDWRAWAT2CX', 'makam-keramat-dato-sanggup', 'Makam Keramat Dato’ Sanggup', 'wisata', NULL, 1.4588375, 109.3151406, NULL, 'Objek WIsata', 'galing', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Keramat Dato’ Sanggup","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37260","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJM91DQA9CVV1Y2FK2', '01MCKH7D90V1RJHGDWRAWAT2CX', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90V1RJHGDWRAWAT2CX');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90VA2CRPCC3TJYDK3R', 'batu-betarup', 'Batu Betarup', 'wisata', NULL, 1.623932, 109.349381, 'https://maps.app.goo.gl/jvc9KPsdGoChJ7zLA', 'Objek WIsata', 'galing', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Batu Betarup","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32664","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJSYZ4WJW1ZG8QP0ZX', '01MCKH7D90VA2CRPCC3TJYDK3R', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90VA2CRPCC3TJYDK3R');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90RTSCFWJ1WNGE7GPM', 'makam-ratu-sepudak', 'Makam Ratu Sepudak', 'wisata', NULL, 1.5054125, 109.3683281, 'https://maps.app.goo.gl/1NryX2t5kgWH9TdNA', 'Objek WIsata', 'galing', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Ratu Sepudak","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26531","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJAMB6PNMMPA1QGEDR', '01MCKH7D90RTSCFWJ1WNGE7GPM', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90RTSCFWJ1WNGE7GPM');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9052M5P2K3DQD3C21Z', 'pantai-puteri-serayi', 'Pantai Puteri Serayi', 'wisata', NULL, 1.2776871, 108.9926389, 'https://maps.app.goo.gl/jF9Rv4dKSNd6WGSw7', 'Objek Wisata', 'jawai-selatan', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Pantai Putri Serayi","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_putri_serayi","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Puteri Serayi","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129954","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJCW5K69S7G507JE1E', '01MCKH7D9052M5P2K3DQD3C21Z', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJF4B6Z49QW648C0D6', '01MCKH7D9052M5P2K3DQD3C21Z', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_putri_serayi_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/110725.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9052M5P2K3DQD3C21Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90WY8305ZT60QPC25M', 'pantai-kalang-bau', 'Pantai Kalang bau', 'wisata', NULL, 1.2028334, 108.96189, 'https://maps.app.goo.gl/79EPpPCxqWx5q6WUA', 'Objek Wisata', 'jawai-selatan', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Menara Suar Kalang Bahu","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/menara_suar_kalang_bahu","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJM992E5Q9XD4SAJNG', '01MCKH7D90WY8305ZT60QPC25M', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJXE7STX10WMBZRXW6', '01MCKH7D90WY8305ZT60QPC25M', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/menara_suar_kalang_bahu_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/128651.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90WY8305ZT60QPC25M');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905YD6H61KYW0G535X', 'taman-wisata-bahari', 'Taman Wisata Bahari', 'wisata', NULL, 1.2949749, 109.0098838, 'https://maps.app.goo.gl/jQkaNWNFs6aPF8Zb9', 'Objek WIsata', 'jawai-selatan', NULL, '[object Object]', NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"Jadesta Kemenpar - Pantai Taman Wisata Bahari","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_taman_wisata_bahari","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Taman Wisata Bahari","type":"web","address":"https://sisparnas.kemenpar.go.id/p/123895","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ1699YDD4FDZCHH91', '01MCKH7D905YD6H61KYW0G535X', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
  UNION ALL
  SELECT '01M5AJGGNJ68QTEA1WGKKZ2PYM', '01MCKH7D905YD6H61KYW0G535X', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_taman_wisata_bahari_JADESTA.jpg', 0, 1, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/98103.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905YD6H61KYW0G535X');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D901VA0R5YXTZXDBG49', 'agro-wisata-matang-nangka', 'Agro Wisata Matang Nangka', 'wisata', NULL, 1.2053448, 109.1615959, 'https://maps.app.goo.gl/93kMZWubSp7NExfq8', 'Objek Wisata', 'tebas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Agro Wisata Matang Nangka","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37356","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJG38PHD87MHCJZ0NW', '01MCKH7D901VA0R5YXTZXDBG49', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D901VA0R5YXTZXDBG49');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D904YPRVGKHWMATN6S1', 'agro-wisata-kota-jeruk', 'Agro Wisata Kota Jeruk', 'wisata', NULL, 1.2054269, 109.1013082, 'https://maps.app.goo.gl/CyEXCDmZg2j1RfY37', 'Objek WIsata', 'tebas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Agro Wisata Kota Jeruk","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27894","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ0FENMSDBN383KXNS', '01MCKH7D904YPRVGKHWMATN6S1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D904YPRVGKHWMATN6S1');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90G4TC3RSGTC1RB7CC', 'taman-rekreasi-batu-mak-jage', 'Taman Rekreasi Batu Mak Jage', 'wisata', NULL, 1.1254221, 109.1548418, 'https://maps.app.goo.gl/QtpFaT7cecMYvGP79', 'Objek WIsata', 'tebas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Taman Rekreasi Batu Mak Jage","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39006","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJZWVHZS6VR3PAJPWJ', '01MCKH7D90G4TC3RSGTC1RB7CC', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90G4TC3RSGTC1RB7CC');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90HYE6R5G4NCTEG428', 'goa-kelelawar', 'Goa Kelelawar', 'wisata', NULL, 1.2760269, 109.985139, 'https://maps.app.goo.gl/nVrdkQ8qhFz5iwar5', 'Goa alami di kawasan Tebas yang jadi rumah banyak kelelawar. Ratusan kelelawar bergelantung di langit-langit goa, dan kamu bisa mengamatinya dari dekat, terutama saat matahari tenggelam ketika mereka mulai keluar mencari makan. Suasananya gelap dan lembap, penuh nuansa petualangan.', 'tebas', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Goa Kelelawar","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37331","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJGE2K0AZGJQNPQ28R', '01MCKH7D90HYE6R5G4NCTEG428', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90HYE6R5G4NCTEG428');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90WHTS3D8WGPJGPRNH', 'air-terjun-riam-merasap', 'Air terjun Riam Merasap', 'wisata', NULL, 1.1272674, 109.744678, 'https://maps.app.goo.gl/EQuDniWJsCr4DxZg7', 'Air terjun di kaki Gunung Senujuh, Desa Sajingan Besar. Airnya mengalir menembus bebatuan dikelilingi hutan tropis yang masih lebat. Trek menuju lokasi punya tingkat kesulitan yang beragam, cocok untuk yang suka petualangan alam terbuka.', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJWZBYS122R5R229KB', '01MCKH7D90WHTS3D8WGPJGPRNH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90WHTS3D8WGPJGPRNH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90DZZQH2H09R2RCTQC', 'air-terjun-riam-cagat', 'Air terjun Riam Cagat', 'wisata', NULL, 1.6304326, 109.644649, 'https://maps.app.goo.gl/H9MBwJARD4rwM4817', 'Objek Wisata', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Air terjun Riam Cagat","type":"web","address":"https://sisparnas.kemenpar.go.id/p/56165","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJQXW8AF80XSRK6444', '01MCKH7D90DZZQH2H09R2RCTQC', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90DZZQH2H09R2RCTQC');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90D44APRK38ZK3MQZ3', 'twa-gunung-dungan', 'TWA Gunung Dungan', 'wisata', NULL, 1.4558751, 109.0520094, 'https://maps.app.goo.gl/Taxk1pAztm9HvvV29', 'Objek Wisata', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Taman Wisata Alam Gunung Dungun","type":"web","address":"https://sisparnas.kemenpar.go.id/p/36189","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ1CTSA3MS2WMW1SKH', '01MCKH7D90D44APRK38ZK3MQZ3', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90D44APRK38ZK3MQZ3');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D907VK8A0471BKAPNC3', 'goa-alam-santok', 'Goa Alam Santok', 'wisata', NULL, 1.6148402, 109.4933338, 'https://maps.app.goo.gl/p5U9Be2CGvo3nPdE9', 'Objek Wisata', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Goa Alam Santok","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26458","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ3N2Y0PWPTSFHADP9', '01MCKH7D907VK8A0471BKAPNC3', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D907VK8A0471BKAPNC3');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9070Z4GX6ZGZMR1YHV', 'riam-sunge-banokng', 'Riam Sunge Banokng', 'wisata', NULL, 1.6606583, 109.6043239, 'https://maps.app.goo.gl/V2R8gDPWssPyNw338', 'Objek Wisata', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Riam Sunge Banokng","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129955","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ1PQ63ZB692S5F7GK', '01MCKH7D9070Z4GX6ZGZMR1YHV', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9070Z4GX6ZGZMR1YHV');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D909JY8T1Z78GW0STJH', 'bukit-piantus', 'Bukit Piantus', 'wisata', NULL, 1.4596049, 109.3149834, 'https://maps.app.goo.gl/MphfpVjrE5qSCU437', 'Objek Wisata', 'sejangkung', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Bukit Piantus","type":"web","address":"https://sisparnas.kemenpar.go.id/p/55237","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJHM5PE4276WAPZF6S', '01MCKH7D909JY8T1Z78GW0STJH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D909JY8T1Z78GW0STJH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90V5CDJAF8GM1P02KS', 'gunung-senujuh', 'Gunung Senujuh', 'wisata', NULL, 1.440249, 109.447872, 'https://maps.app.goo.gl/bfgNnvNx7hwCWZFk9', 'Objek Wisata', 'sejangkung', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Gunung Senujuh","type":"web","address":"https://sisparnas.kemenpar.go.id/p/134731","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ2TCZ1WC8ZD7MJHH0', '01MCKH7D90V5CDJAF8GM1P02KS', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90V5CDJAF8GM1P02KS');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D905M2V8D7KG5MKQT3P', 'makam-to-kullub', 'Makam To’ Kullub', 'wisata', NULL, 1.4588467, 109.3151266, NULL, 'Objek WIsata', 'sejangkung', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam To’ Kullub","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32578","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJD1EN0G3PGT8A7ZTR', '01MCKH7D905M2V8D7KG5MKQT3P', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D905M2V8D7KG5MKQT3P');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90125AX6ZHGXDMT207', 'rumah-batu', 'Rumah Batu', 'wisata', NULL, 1.154876, 109.4736136, 'https://maps.app.goo.gl/JT1rUgHzikGj5igq6', 'Objek Wisata', 'subah', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Rumah Batu","type":"web","address":"https://sisparnas.kemenpar.go.id/p/39001","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJBQEM2FTSN414097X', '01MCKH7D90125AX6ZHGXDMT207', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90125AX6ZHGXDMT207');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KXRDRTAGMPB62CRF', 'kebun-raya-sambas', 'Kebun Raya Sambas', 'wisata', NULL, 1.2699086, 109.4852044, 'https://maps.app.goo.gl/ziUmiSKvdjfvKWPP9', 'Objek WIsata', 'subah', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Kebun Raya Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27892","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJYXAHK25K5TAQ9NTM', '01MCKH7D90KXRDRTAGMPB62CRF', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KXRDRTAGMPB62CRF');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90YDSS634HV26YT5YJ', 'perkebunan-salak', 'Perkebunan Salak', 'wisata', NULL, 1.4717995, 109.2230538, 'https://maps.app.goo.gl/ihNoAwk3rvMbKHBd6', 'Objek WIsata', 'teluk-keramat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJ34J77BP69ZN97T3S', '01MCKH7D90YDSS634HV26YT5YJ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90YDSS634HV26YT5YJ');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90ZNZAFZTMTKAVAHFR', 'tanjung-monang', 'Tanjung Monang', 'wisata', NULL, 1.3226802, 109.1774838, 'https://maps.app.goo.gl/UeVRiJY2s57P65vi6', 'Objek Wisata', 'teluk-keramat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Tanjung Monang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37327","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJCR387ZYVADTTAQYE', '01MCKH7D90ZNZAFZTMTKAVAHFR', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90ZNZAFZTMTKAVAHFR');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90DFE87MY9590A2G8K', 'makam-keramat-sungai-kumpai', 'Makam Keramat Sungai Kumpai', 'wisata', NULL, 1.44545, 109.1998972, 'https://maps.app.goo.gl/wprjD9YVCHV4xJeK8', 'Objek Wisata', 'teluk-keramat', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Keramat Sungai Kumpai","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37324","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNJQWG0GV753B0EY4BY', '01MCKH7D90DFE87MY9590A2G8K', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90DFE87MY9590A2G8K');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90W30SME2E8QXXCJEE', 'perkebunan-sawo', 'Perkebunan Sawo', 'wisata', NULL, 1.2703429, 109.1298238, 'https://maps.app.goo.gl/CyUMbjeA5T4xxYht9', 'Objek WIsata', 'tekarang', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Perkebunan Sawo","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27891","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKFDT5SGN8YPA6R65J', '01MCKH7D90W30SME2E8QXXCJEE', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90W30SME2E8QXXCJEE');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D9003AQD1WJQFT5544J', 'rumah-petinggi-tekarang', 'Rumah Petinggi Tekarang', 'wisata', NULL, 1.2615132, 109.0956351, 'https://maps.app.goo.gl/uuMKXwr9UoYvguFo7', 'Objek Wisata', 'tekarang', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Rumah Petinggi Tekarang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37317","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK62K5DJ6Y76NNYVQ4', '01MCKH7D9003AQD1WJQFT5544J', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D9003AQD1WJQFT5544J');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90KAZW2Q3JJKP6FSY5', 'makam-petinggi-tekarang', 'Makam Petinggi Tekarang', 'wisata', NULL, 1.2706976, 109.1212793, 'https://maps.app.goo.gl/tDUWeJXuWkq1MJGDA', 'Objek Wisata', 'tekarang', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Petinggi Tekarang","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37285","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK1WA039JAQS1N48FT', '01MCKH7D90KAZW2Q3JJKP6FSY5', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90KAZW2Q3JJKP6FSY5');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90AFV7HKA3GTX2QEFH', 'agro-wisata-buah-naga', 'Agro Wisata Buah Naga', 'wisata', NULL, 1.3343324484087697, 109.03875252741437, NULL, 'Objek WIsata', 'jawai', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Agro Wisata Buah Naga","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27895","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK8RF7JGYR4A15PB1G', '01MCKH7D90AFV7HKA3GTX2QEFH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90AFV7HKA3GTX2QEFH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D903BV5467483MHZNE8', 'air-terjun-gunung-selindung', 'Air terjun Gunung Selindung', 'wisata', NULL, 1.1032109, 109.005479, 'https://maps.app.goo.gl/LGkFhuM2s1HeyRcG8', 'Objek WIsata', 'salatiga', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Air terjun Gunung Selindung","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37277","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKT78MSKFC90N7R38W', '01MCKH7D903BV5467483MHZNE8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D903BV5467483MHZNE8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90XQK9QFV56HFG7TSG', 'makam-bantilan', 'Makam Bantilan', 'wisata', NULL, 1.4111562, 109.4039902, 'https://maps.app.goo.gl/RaPkZvQBuTrkTCJ29', 'Objek Wisata', 'sajad', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Makam Bantilan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/32543","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKA6W1TMRBK522VZ19', '01MCKH7D90XQK9QFV56HFG7TSG', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90XQK9QFV56HFG7TSG');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90S6EMR50J9XB7H03A', 'danau-biru', 'Danau Biru', 'wisata', NULL, 1.0507987, 109.11807, 'https://maps.app.goo.gl/WM2z9uafQkGK55Jm9', 'Objek Wisata', 'selakau-timur', NULL, NULL, NULL, '[{"name":"Open Data Sambas - Objek Wisata (dataset 116)","type":"web","address":"https://opendata.sambas.go.id/json/116","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"},{"name":"SISPARNAS Kemenpar - Danau Biru","type":"web","address":"https://sisparnas.kemenpar.go.id/p/37273","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKEF13HKNSCSCZB59E', '01MCKH7D90S6EMR50J9XB7H03A', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/placeholder.webp', 1, 0, NULL
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90S6EMR50J9XB7H03A');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90XD5HHG84MEFYGT44', 'batu-nenek', 'Batu Nenek', 'wisata', NULL, 2.01894718153, 109.6014829, NULL, 'Titik dua kelapa menjadi ikon utama pariwisata Desa Temajuk saat ini karena mempunyai landsekap yang unik menyerupai daerah belitung', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Batu Nenek","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/batu_nenek","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Batu Nenek","type":"web","address":"https://sisparnas.kemenpar.go.id/p/27893","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKB4EE4CX82SFFWVMQ', '01MCKH7D90XD5HHG84MEFYGT44', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/batu_nenek_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/35234.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90XD5HHG84MEFYGT44');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90HG4B5ACCF4AN24KS', 'hutan-magrove-dusun-maludin', 'Hutan Mangrove Dusun Maludin', 'wisata', NULL, NULL, NULL, NULL, 'Kawasan sungai ini juga memiliki keunikan berupa warna air sungai biru tosca ketika pasang air laut dan ditambah dengan barisan hutan bakau disisi sungai.', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Hutan Magrove Dusun Maludin","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/hutan_magrove_dusun_maludin","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKWPXC7W12N1V0164W', '01MCKH7D90HG4B5ACCF4AN24KS', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/hutan_magrove_dusun_maludin_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/35271.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90HG4B5ACCF4AN24KS');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90209PY2DWBDY7KQAZ', 'resort-camar-bulan', 'Resort Camar Bulan', 'wisata', NULL, 1.9929625903499533, 109.59185981356971, NULL, 'Resort Camar Bulan merupakan satu kawasan pantai yang terdiri dari spot foto, villa, watersport, tempat makan dan hiburan berupa live music.', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Resort Camar Bulan","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/resort_camar_bulan","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Resort Camar Bulan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53107","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK5AK12DFKV5K7WEDC', '01MCKH7D90209PY2DWBDY7KQAZ', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/resort_camar_bulan_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/129181.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90209PY2DWBDY7KQAZ');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90X5B21BNKGRFF87BG', 'crab-village-temajuk', 'Crab Village Temajuk', 'wisata', NULL, 1.9876991022874162, 109.58617988010586, NULL, 'Crab Village Temajuk di Desa Temaajuk, Kabupaten Sambas.', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Crab Village Temajuk","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/crab_village_temajuk","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Crab Village Temajuk","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53238","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKAXSJX91T7P7YKFQV', '01MCKH7D90X5B21BNKGRFF87BG', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/crab_village_temajuk_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/129199.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90X5B21BNKGRFF87BG');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90TTB3T70ZVHJXB4M8', 'susur-sungai-11', 'Susur Sungai', 'wisata', NULL, 1.3842406, 109.3590377, NULL, 'Susur sungai dilakukan menggunakan perahu ataupun motor kecil. Susur sungai dibantu oleh pemandu wisata. Kegiatan susur sungai dilakukan sambil melihat keindahan Desa Sumber Harapan dari sudut pesisir sungai.', 'sambas', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Susur Sungai","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/susur_sungai_11","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKRXH1SMKM9EM3S95S', '01MCKH7D90TTB3T70ZVHJXB4M8', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/susur_sungai_11_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/61261.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90TTB3T70ZVHJXB4M8');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90WXF3RM99QX7DW0GX', 'batulapak', 'Batulapak', 'wisata', NULL, 1.2716011714495097, 108.98767328375143, NULL, 'Batulapak merupakan DTW pantai yang didalamnya terdapat bukit, pulau kecil (pulau pontianak) dan bangunan penahan abrasi dengan luas area 20.000 meter persegi. Aktivitas utama di DTW Batulapak adalah berfoto dengan landsekap pantai dari atas bukit ditambah dengan gugusan batu yang cantik. DTW Batula', 'jawai', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Batulapak","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/batulapak","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Batulapak","type":"web","address":"https://sisparnas.kemenpar.go.id/p/134729","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKFDXWRKDQ4RG1WZBR', '01MCKH7D90WXF3RM99QX7DW0GX', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/batulapak_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/98165.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90WXF3RM99QX7DW0GX');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90DVS2SCCW50B8P7P3', 'pantai-sungai-belacan', 'Pantai Sungai Belacan', 'wisata', NULL, 1.9443576828520326, 109.37528214378317, NULL, 'Pantai Sungai Belacan di Desa Sebubus, Kabupaten Sambas.', 'paloh', NULL, '[object Object]', NULL, '[{"name":"Jadesta Kemenpar - Pantai Sungai Belacan","type":"web","address":"https://jadesta.kemenpar.go.id/atraksi/pantai_sungai_belacan","license":"Hak cipta Kementerian Pariwisata RI","licenseUrl":null},{"name":"SISPARNAS Kemenpar - Pantai Sungai Belacan","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53291","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK353MFCZCZ974H6SA', '01MCKH7D90DVS2SCCW50B8P7P3', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai_sungai_belacan_JADESTA.jpg', 1, 0, '{"name":"Jadesta - Kementerian Pariwisata RI","provider":"jadesta","url":"https://jadesta.kemenpar.go.id/imgpost/59412.jpg","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90DVS2SCCW50B8P7P3');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D904PHGHDDB3RTXN4R7', 'pasar-wisata-aruk', 'Pasar Wisata Aruk', 'wisata', NULL, 1.6047177141127575, 109.67606039657066, NULL, 'Pasar perbatasan di Aruk, Kecamatan Sajingan Besar, ujung utara Kabupaten Sambas menuju Sarawak. Gerbang perdagangan lintas batas Malaysia-Indonesia.', 'sajingan-besar', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pasar Wisata Aruk","type":"web","address":"https://sisparnas.kemenpar.go.id/p/135149","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90J2D7R20WNM4X6ASK', 'kelenteng-sam-bong-ja', 'Kelenteng Sam Bong Ja Sam San Ket Bong', 'budaya', 'sejarah', 1.36398, 109.29731, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Kelenteng Sam Bong Ja Sam San Ket Bong","type":"web","address":"https://sisparnas.kemenpar.go.id/p/26542","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK6HM8Y9NYCBM6R6QR', '01MCKH7D90J2D7R20WNM4X6ASK', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/kelenteng-sam-bong-ja_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/26542","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90J2D7R20WNM4X6ASK');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90QSNK5NPYKR1REARA', 'museum-tamadun-islam', 'Museum Tamadun Islam', 'budaya', 'sejarah', 1.356705, 109.315327, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Museum Tamadun Islam","type":"web","address":"https://sisparnas.kemenpar.go.id/p/30276","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKSZ8Z0VXKD6T6HT9P', '01MCKH7D90QSNK5NPYKR1REARA', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/museum-tamadun-islam_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/30276","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90QSNK5NPYKR1REARA');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90SBKD9TTK9ME5EZYH', 'museum-khazanah-melayu-h-subhan-nur', 'Museum Khazanah Melayu H. Subhan Nur', 'budaya', 'sejarah', 1.3689004564, 109.2962237, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Museum Khazanah Melayu H. Subhan Nur","type":"web","address":"https://sisparnas.kemenpar.go.id/p/30270","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKTKADGN5CSB4K77RR', '01MCKH7D90SBKD9TTK9ME5EZYH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/museum-khazanah-melayu-h-subhan-nur_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/30270","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90SBKD9TTK9ME5EZYH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90TXFHGBJK4NN6C0TK', 'dermaga-wisata-sambas', 'Dermaga Wisata Sambas', 'budaya', 'sejarah', 1.38992349, 109.31831505, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Dermaga Wisata Sambas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/30286","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKAWSHDACJ4GKSYH0V', '01MCKH7D90TXFHGBJK4NN6C0TK', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/dermaga-wisata-sambas_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/30286","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90TXFHGBJK4NN6C0TK');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D902QPRMNVR9HD3EQNR', 'galeri-rotan-sejangkung', 'Galeri Rotan Sejangkung', 'budaya', NULL, 1.4398009584262332, 109.31326825465254, NULL, '', 'sejangkung', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Galeri Rotan Sejangkung","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129536","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90FXN39Y87XKX45C9Q', 'rumah-terbalik', 'Rumah Terbalik', 'budaya', NULL, 1.9896, 109.59075, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Rumah Terbalik","type":"web","address":"https://sisparnas.kemenpar.go.id/p/24354","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKK949D8PPDXD97AZ5', '01MCKH7D90FXN39Y87XKX45C9Q', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/rumah-terbalik_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/24354","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90FXN39Y87XKX45C9Q');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90B1AXMCY63ZXB21QB', 'rumah-kediaman-h-sood', 'Rumah Kediaman H. Sood Datuk Kaya Lela Mahkota', 'budaya', 'sejarah', 1.36677135, 109.30828, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Rumah Kediaman H. Sood Datuk Kaya Lela Mahkota","type":"web","address":"https://sisparnas.kemenpar.go.id/p/30274","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKJDHQ1WVXEVN7RWJB', '01MCKH7D90B1AXMCY63ZXB21QB', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/rumah-kediaman-h-sood_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/30274","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90B1AXMCY63ZXB21QB');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90N1G0EKWM0EEJYX8J', 'pantai-jlo', 'Pantai JLO', 'wisata', NULL, 2.0323093557973, 109.6089442873117, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pantai JLO","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53284","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKVC6JW1M2QC3HZ7DB', '01MCKH7D90N1G0EKWM0EEJYX8J', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai-jlo_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/53284","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90N1G0EKWM0EEJYX8J');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90QMKMZHE0Z7SV2XW1', 'pantai-katsuri-indah', 'Pantai Katsuri Indah', 'wisata', NULL, 1.4475503249415531, 109.03619231008457, NULL, '', 'jawai', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pantai Katsuri Indah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/55233","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKC5X2968A8ZMVTWMW', '01MCKH7D90QMKMZHE0Z7SV2XW1', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai-katsuri-indah_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/55233","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90QMKMZHE0Z7SV2XW1');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90D4F7MZH6XSR765FR', 'pantai-matang-danau', 'Pantai Matang Danau', 'wisata', NULL, 1.620613905958414, 109.19940032347503, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pantai Matang Danau","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129535","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK9NDV2FGDABG0FSWF', '01MCKH7D90D4F7MZH6XSR765FR', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai-matang-danau_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/129535","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90D4F7MZH6XSR765FR');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90CEEX6G84P88FG2GH', 'pantai-pjm', 'Pantai PJM', 'wisata', NULL, 2.0072855857522898, 109.58994148231798, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pantai PJM","type":"web","address":"https://sisparnas.kemenpar.go.id/p/129063","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK1JQGT9FNZNZMEH7K', '01MCKH7D90CEEX6G84P88FG2GH', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai-pjm_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/129063","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90CEEX6G84P88FG2GH');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D909KM71TC2MA106Q97', 'pantai-tiara', 'Pantai Tiara', 'wisata', NULL, 2.0294838598437273, 109.60778857094216, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Pantai Tiara","type":"web","address":"https://sisparnas.kemenpar.go.id/p/53277","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNK8WH5ZFBZ201JN2XA', '01MCKH7D909KM71TC2MA106Q97', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/pantai-tiara_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/53277","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D909KM71TC2MA106Q97');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90163RH5RM5K86T218', 'perkebunan-lada', 'Perkebunan Lada', 'wisata', NULL, 1.90181898501, 109.4305050321, NULL, '', 'paloh', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Perkebunan Lada","type":"web","address":"https://sisparnas.kemenpar.go.id/p/38757","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90SX9H3GGNQSP1SSX2', 'ramin-bantang-sungai-rambah', 'Ramin Bantang Sungai Rambah', 'wisata', NULL, 1.32568, 109.2795, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Ramin Bantang Sungai Rambah","type":"web","address":"https://sisparnas.kemenpar.go.id/p/25455","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKGK9MJERPC7D40KGR', '01MCKH7D90SX9H3GGNQSP1SSX2', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/ramin-bantang-sungai-rambah_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/25455","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90SX9H3GGNQSP1SSX2');
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90YE41ZRJBNT81YYZ7', 'agro-wisata-buah-nenas', 'Agro Wisata Buah Nenas', 'wisata', NULL, 1.364624485, 109.21269522866, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Agro Wisata Buah Nenas","type":"web","address":"https://sisparnas.kemenpar.go.id/p/38756","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `type`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `hours`, `contact`, `author_id`, `sources_json`, `status`, `created_at`) VALUES ('01MCKH7D90JRYSJAP7PDM2JTRA', 'taman-lunggi', 'Taman Lunggi', 'wisata', NULL, 1.36454144, 109.3230984, NULL, '', 'sambas', NULL, NULL, NULL, '[{"name":"SISPARNAS Kemenpar - Taman Lunggi","type":"web","address":"https://sisparnas.kemenpar.go.id/p/30282","license":"Data Resmi Kementerian Pariwisata RI","licenseUrl":null}]', 'published', unixepoch());
--> statement-breakpoint
INSERT INTO `place_images` (`id`, `place_id`, `url`, `is_main`, `sort_order`, `attribution_json`)
SELECT * FROM (
  SELECT '01M5AJGGNKVY0Y1REJ4H48D14M', '01MCKH7D90JRYSJAP7PDM2JTRA', 'https://cdn.jsdelivr.net/gh/sambasku/images@main/assets/places/taman-lunggi_SISPARNAS.jpg', 1, 0, '{"name":"SISPARNAS - Kementerian Pariwisata RI","provider":"sisparnas","url":"https://sisparnas.kemenpar.go.id/p/30282","license":null,"licenseUrl":null}'
) WHERE NOT EXISTS (SELECT 1 FROM `place_images` WHERE `place_id` = '01MCKH7D90JRYSJAP7PDM2JTRA');
