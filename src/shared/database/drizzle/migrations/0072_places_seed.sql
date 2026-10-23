-- Seed katalog Place dari data/places.json (field faktual saja).
-- id = ULID 26 char (deterministik dari slug). slug tetap URL publik.
-- Sekali jalan lewat db:migrate. OR IGNORE: aman kalau seed-places.ts sudah pernah jalan.
-- short_description kosong: kolom NOT NULL, diisi string kosong.
-- Deskripsi/foto/jam/kontak/sources diisi admin lewat console (SoT Turso).
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90FDYAGB3RKR2BP164', 'istana-alwatzikoebillah', 'Istana Alwatzikoebillah', 'wisata', 1.361722806, 109.3130395, 'https://maps.app.goo.gl/2WmeQwzcwDrWaGb56', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90NA9WXBDF8QZWS6VZ', 'masjid-jami-sultan-muhammad-shafiuddin-ii', 'Masjid Jami Keraton Sambas', 'wisata', 1.37515, 109.31792, 'https://maps.app.goo.gl/RW2zZF7f3Go3BRi77', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KKCS6CJEZRCD6Y3X', 'waterfront-sambas', 'Waterfront Sambas', 'wisata', 1.3636572, 109.314685, 'https://maps.app.goo.gl/fRwLy5kg2sRfM3Xk8', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90Q4W2NHHPKCH5E7MA', 'makam-kesultanan-sambas-dan-kerabat', 'Makam Kesultanan Sambas dan Kerabat', 'wisata', 1.37722, 109.31518, 'https://maps.app.goo.gl/M4Yd5VSZz28vB6im7', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KFY9C8GD6HYHA4D1', 'bangunan-kantor-kewedanaan-balairung-sari', 'Bangunan Kantor Kewedanaan Balairung Sari', 'wisata', 1.365193, 109.297026, 'https://maps.app.goo.gl/mVdQAfjQcgZSJLCy6', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905HHJ8B79YTSYA7Z8', 'jembatan-gerattak-asam', 'Jembatan (Gerattak) Asam', 'wisata', 1.3613897, 109.3081027, 'https://maps.app.goo.gl/zZpKCwGy4xj7QQPx8', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905YD61YHQ3NSD19TQ', 'jembatan-gerattak-batu', 'Jembatan (Gerattak) Batu', 'wisata', 1.3648001, 109.3004797, 'https://maps.app.goo.gl/pEpBMLYZna5DNRmK6', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90TNVEZJNZGY22HM99', 'museum-negeri-sambas', 'Museum Negeri Sambas', 'wisata', 1.3647247, 109.2968682, 'https://maps.app.goo.gl/bvAwr3D7anKsyoXy8', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90WQ2RGM7JY5QEJEWM', 'kampung-tenun-semberang', 'Kampung Tenun Semberang', 'wisata', 1.380082, 109.3494927, 'https://maps.app.goo.gl/CLm1MxavRiMRhoJi9', '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90NHKKCB4X0C56YXJX', 'markas-polisi-belanda', 'Markas Polisi Belanda', 'wisata', 1.17619106, 108.97035502, 'https://maps.app.goo.gl/rzcBrfThWM5NvB1DA', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90J45AP7AHPYG2716X', 'rumah-tahanan-belanda', 'Rumah Tahanan Belanda', 'wisata', 1.1799875, 108.9694219, 'https://maps.app.goo.gl/3Dc2vGFjteD4c4j77', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90FYE9P1V5X7Q1WCAM', 'makam-fj-sorg', 'Makam F.J Sorg', 'wisata', 1.1755598, 108.9762849, 'https://maps.app.goo.gl/E7CFq9n2PN8wXceH6', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90B8TZ7BDFP65E66PF', 'benteng-peninggalan-belanda', 'Benteng Peninggalan Belanda', 'wisata', 1.15534701864, 108.9482983172, 'https://maps.app.goo.gl/Ctwitz1SRefnpFGy9', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90QBBY5AZSMS0S7P2T', 'sumur-peninggalan-belanda', 'Sumur Peninggalan Belanda', 'wisata', 1.3589274, 109.3156144, 'https://maps.app.goo.gl/mepsoqQ6GVpedTn99', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90YAQ3NVD7MEDFRYAR', 'tugu-fasisme', 'Tugu Peringatan Perang', 'wisata', 1.1799759, 108.9694348, 'https://maps.app.goo.gl/L6c3K75AqNwdEkVd8', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90PVRW6QA50QA5BF89', 'pantai-tanjung-batu', 'Pantai Tanjung Batu', 'wisata', 1.157062631, 108.979536, 'https://maps.app.goo.gl/CZz6HChfqfyeqM1B9', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90S37T7N1W8Y0ZJB9R', 'pantai-sinam', 'Pantai Sinam', 'wisata', 1.1753799, 108.9706002, 'https://maps.app.goo.gl/2uLRo62bhS7yJm2V8', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90E248G015TSN1SGNH', 'toa-pekong-ular-putih', 'Toa Pekong Ular Putih', 'wisata', 1.1526958, 108.9683729, 'https://maps.app.goo.gl/3LHj1QKzdMVTSw2n6', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905D7YQVDN7SKQ3FBV', 'toa-pekong-dewi-kwan-im', 'Toa Pekong Dewi Kwan Im', 'wisata', 1.1298789, 108.9682563, 'https://maps.app.goo.gl/6Z2q6QUaqh8cvs69A', '', 'pemangkat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D900QA972EG692QYVWM', 'taman-istana-putri-danau-sebedang', 'Taman Istana Putri Danau Sebedang', 'wisata', 1.2612873567, 109.176594135, 'https://maps.app.goo.gl/o7q6pwHkM79QrZqC9', '', 'sebawi', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90T3YRWBSGYBDBJ78H', 'danau-sebedang', 'Danau Sebedang', 'wisata', 1.2577544, 109.1952949, 'https://maps.app.goo.gl/PFUyEVXLdFDvuV3R8', '', 'sebawi', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90G054SCV91H68TME5', 'makam-bujang-nadi-dare-nandung', 'Makam Bujang Nadi Dare Nandung', 'wisata', 1.2631263, 109.179506, 'https://maps.app.goo.gl/cRKxmiueL6UzGQYUA', '', 'sebawi', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9090FYFKJ5374629SG', 'surau-peninggalan-raden-sulaiman', 'Surau Peninggalan Raden Sulaiman', 'wisata', 1.2896135, 109.1748561, 'https://maps.app.goo.gl/vyfoMgZHHDkMJ4Zz7', '', 'sebawi', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90XQ4ZZKXMA7A49HW3', 'pantai-tanjung-lestari', 'Pantai Tanjung Lestari', 'wisata', 1.6326494, 109.2217426, 'https://maps.app.goo.gl/epsVQjEKcxQ4itpF9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D902QJC511GN4F5QN3S', 'pantai-harapan', 'Pantai Harapan', 'wisata', 1.6498106, 109.2430236, 'https://maps.app.goo.gl/NoJ1ptGd2ZsEkEqy7', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90WGK3DCPCK7EEHPCS', 'pantai-pulau-selimpai', 'Pantai Pulau Selimpai', 'wisata', 1.7847358, 109.296512, 'https://maps.app.goo.gl/Fd9FjaEAPQwgpzU87', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9021DBN7ZD7DJ1XJBA', 'pantai-kampak-indah', 'Pantai Kampak Indah', 'wisata', 1.96017178783, 109.350546466, 'https://maps.app.goo.gl/zKpZ8xB4Wwp2JbJg7', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9031NGB9M6KB96YYF5', 'pantai-camar-bulan', 'Pantai Camar Bulan', 'wisata', 1.992341189708762, 109.58931838195315, 'https://maps.app.goo.gl/mtyr1UQSzEVSE1FT9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905KMZVRG4DMQ4R0AM', 'pantai-tanjung-bendera', 'Pantai Tanjung Bendera', 'wisata', 1.9423508, 109.3381533, 'https://maps.app.goo.gl/CZz6HChfqfyeqM1B9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90113P4YDFE4X720VB', 'pantai-tanjung-kemuning', 'Pantai Tanjung Kemuning', 'wisata', 1.181607, 108.9693382, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90XQWHSC1FN5BN5FZP', 'pantai-banyuan', 'Pantai Banyuan', 'wisata', 1.6318345, 109.2219144, 'https://maps.app.goo.gl/nVeLjnRGn9zuTt9i9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90G7F7BY1NNWZT2KPP', 'dermaga-asam-jawe', 'Dermaga Asam Jawe', 'wisata', 1.8306473, 109.3703083, 'https://maps.app.goo.gl/Rd9EfD7KMuD13LsP6', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D900ZQSR8NPKSWGMPE8', 'pantai-telok-atong-bahari', 'Pantai Telok Atong Bahari', 'wisata', 2.043977297829329, 109.61517145824173, 'https://maps.app.goo.gl/bRbXodzyYRNr7F3J6', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KCW4KN6702CQA6S1', 'pantai-batu-pipih', 'Pantai Batu Pipih', 'wisata', 1.9383707, 109.3420023, 'https://maps.app.goo.gl/SiQv5X6CbQ964yUi6', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90844FETBG1MK51867', 'pantai-kalimantan', 'Pantai Kalimantan', 'wisata', 1.84966189, 109.4002856, 'https://maps.app.goo.gl/fmRL6GcgD2mS3NsY9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90RJY0P284TKQEZJT5', 'pantai-teluk-cemara-guntung', 'Pantai Teluk Cemara Guntung', 'wisata', 1.908681642, 109.3824329, 'https://maps.app.goo.gl/hux1N8qLjeCNT2T5A', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90B04T4ZFMY30VNTDM', 'hutan-hujan-tropis-tanjung-dato-di-temajuk', 'Hutan Hujan Tropis Tanjung Dato di Temajuk', 'wisata', 1.9823587, 109.5497303, 'https://maps.app.goo.gl/HvptwTpA1ardxroB9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90B8PH14S5X25AZAGB', 'air-terjun-teluk-nibung', 'Air terjun Teluk Nibung', 'wisata', 1.87436807604, 109.40715215236, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D908R7KDTFJW3D3H9RW', 'air-terjun-gunung-pangi', 'Air terjun Gunung Pangi', 'wisata', 1.9918032, 109.6032325, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90455XHZ5CNQ2SKG30', 'twa-sungai-liku', 'TWA Sungai Liku', 'wisata', 1.7433012, 109.3164602, 'https://maps.app.goo.gl/WmJMKxk5sQj2VXwv7', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90C7SSDVZ8MSPVKQA6', 'twa-gunung-melintang', 'TWA Gunung Melintang', 'wisata', 1.719199085, 109.5791482, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90Y1Q0R9CT59RJA154', 'twa-asuansang', 'TWA Asuansang', 'wisata', 1.8299018, 109.4558617, 'https://maps.app.goo.gl/eaw1rnK5kdppyrjYA', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90ADYWK2F8V8F48DD1', 'twa-tanjung-belimbing', 'TWA Tanjung Belimbing', 'wisata', 1.795456411, 109.30944862, 'https://maps.app.goo.gl/KqMyiGES3geEr3PbA', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9093XW9AHRQRX5DSG2', 'taman-rekreasi-batu-bejamban', 'Taman Rekreasi Batu Bejamban', 'wisata', 1.8769757833, 109.450007107, 'https://maps.app.goo.gl/HSeViVRkB8rCRvfT7', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KBP3CTRK7QK24EVJ', 'pantai-rindu-samudera', 'Pantai Rindu Samudera', 'wisata', 1.9040912, 109.331257, 'https://maps.app.goo.gl/NxtF4LPyAFvbjRky8', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90S8CNN75QTSA7W352', 'pantai-tanjung-api', 'Pantai Tanjung Api', 'wisata', 1.8275625, 109.3704375, 'https://maps.app.goo.gl/Aojkry6jyATzR3NZ9', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D902DPH0DEZFYWY210Y', 'taman-wisata-mangrove-sebubus', 'Taman Wisata Mangrove Sebubus', 'wisata', 1.7835380245618957, 109.33488484883115, 'https://maps.app.goo.gl/xczqJ5V7nWUtPpyH8', '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90NTDEC4FKTF65Z9F4', 'pantai-kahona', 'Pantai Kahona', 'wisata', 1.464816, 109.0384929, 'https://maps.app.goo.gl/wXEq4avHyW7SZxQ6A', '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90T254Y6F1WA1WQJFS', 'pantai-natuna-indah', 'Pantai Natuna Indah', 'wisata', 1.3194005, 109.0287451, 'https://maps.app.goo.gl/J2RUHnyztQ6fptxp7', '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D909THMDG20QVD3PGS8', 'pantai-datok-buntar', 'Pantai Datok Buntar', 'wisata', 1.3141809, 109.0253069, 'https://maps.app.goo.gl/y9p4VrFvgDizJhZG8', '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90QT9VRV7M3KR7E0CG', 'pantai-polaria', 'Pantai Polaria', 'wisata', 1.0349875, 108.9692969, 'https://maps.app.goo.gl/M9ivjrhF4bhaXkrD7', '', 'selakau', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D909HQWXDJR1PYHFSNR', 'pantai-saaditerigas', 'Pantai Saadi/Terigas', 'wisata', 1.3138131, 109.0047323, NULL, '', 'selakau', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90E6V6XRNDMXFVJ3QM', 'makam-ratu-anom-kesuma-yuda', 'Makam Ratu Anom Kesuma Yuda', 'wisata', 1.0696816063, 108.99979462, NULL, '', 'selakau', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90CJZYSAMC53N7E2HP', 'makam-pangeran-timba-bayi', 'Makam Pangeran Timba’ Bayi', 'wisata', 1.05723401, 108.968669, NULL, '', 'selakau', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90PZJY8AG0V7N1KC4W', 'pantai-muare-jalan-indah', 'Pantai Muare Jalan Indah', 'wisata', 1.6037961, 109.1631238, NULL, '', 'tangaran', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90ASJFE46T8C8KJ2F8', 'pantai-dataran-merdeka', 'Pantai Dataran Merdeka', 'wisata', 1.540573, 109.1128496, 'https://maps.app.goo.gl/k9vdXN4MB69gnZbN6', '', 'tangaran', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90VJVTTXA8G903C2TK', 'pantai-tanjung-terabitan', 'Pantai Tanjung Terabitan', 'wisata', 1.5488098212, 109.111476364, NULL, '', 'tangaran', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D901HMS1KH8Y9FH3B4X', 'pantai-venesia', 'Pantai Venesia', 'wisata', 1.5305057, 109.0661569, 'https://maps.app.goo.gl/zRMutrSJLE19VjX86', '', 'tangaran', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90NF19A0ZK5FKDF2B4', 'makamsyech-muhammad-sattaruddin', 'MakamSyech Muhammad Sattaruddin', 'wisata', 1.0579125, 108.9754219, 'https://maps.app.goo.gl/tQ3WB2eSBbsZxkQW7', '', 'galing', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90MWV196MAGPKVRHEG', 'makam-dato-timalar-tan-azis-bujang', 'Makam Dato’ Timalar Tan Azis Bujang', 'wisata', 1.59338208616, 109.32232359, NULL, '', 'galing', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90V1RJHGDWRAWAT2CX', 'makam-keramat-dato-sanggup', 'Makam Keramat Dato’ Sanggup', 'wisata', 1.4588375, 109.3151406, NULL, '', 'galing', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90VA2CRPCC3TJYDK3R', 'batu-betarup', 'Batu Betarup', 'wisata', 1.623932, 109.349381, 'https://maps.app.goo.gl/jvc9KPsdGoChJ7zLA', '', 'galing', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90RTSCFWJ1WNGE7GPM', 'makam-ratu-sepudak', 'Makam Ratu Sepudak', 'wisata', 1.5054125, 109.3683281, 'https://maps.app.goo.gl/1NryX2t5kgWH9TdNA', '', 'galing', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9052M5P2K3DQD3C21Z', 'pantai-puteri-serayi', 'Pantai Puteri Serayi', 'wisata', 1.2776871, 108.9926389, 'https://maps.app.goo.gl/jF9Rv4dKSNd6WGSw7', '', 'jawai-selatan', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90WY8305ZT60QPC25M', 'pantai-kalang-bau', 'Pantai Kalang bau', 'wisata', 1.2028334, 108.96189, 'https://maps.app.goo.gl/79EPpPCxqWx5q6WUA', '', 'jawai-selatan', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905YD6H61KYW0G535X', 'taman-wisata-bahari', 'Taman Wisata Bahari', 'wisata', 1.2949749, 109.0098838, 'https://maps.app.goo.gl/jQkaNWNFs6aPF8Zb9', '', 'jawai-selatan', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D901VA0R5YXTZXDBG49', 'agro-wisata-matang-nangka', 'Agro Wisata Matang Nangka', 'wisata', 1.2053448, 109.1615959, 'https://maps.app.goo.gl/93kMZWubSp7NExfq8', '', 'tebas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D904YPRVGKHWMATN6S1', 'agro-wisata-kota-jeruk', 'Agro Wisata Kota Jeruk', 'wisata', 1.2054269, 109.1013082, 'https://maps.app.goo.gl/CyEXCDmZg2j1RfY37', '', 'tebas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90G4TC3RSGTC1RB7CC', 'taman-rekreasi-batu-mak-jage', 'Taman Rekreasi Batu Mak Jage', 'wisata', 1.1254221, 109.1548418, 'https://maps.app.goo.gl/QtpFaT7cecMYvGP79', '', 'tebas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90HYE6R5G4NCTEG428', 'goa-kelelawar', 'Goa Kelelawar', 'wisata', 1.2760269, 109.985139, 'https://maps.app.goo.gl/nVrdkQ8qhFz5iwar5', '', 'tebas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90WHTS3D8WGPJGPRNH', 'air-terjun-riam-merasap', 'Air terjun Riam Merasap', 'wisata', 1.1272674, 109.744678, 'https://maps.app.goo.gl/EQuDniWJsCr4DxZg7', '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90DZZQH2H09R2RCTQC', 'air-terjun-riam-cagat', 'Air terjun Riam Cagat', 'wisata', 1.6304326, 109.644649, 'https://maps.app.goo.gl/H9MBwJARD4rwM4817', '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90D44APRK38ZK3MQZ3', 'twa-gunung-dungan', 'TWA Gunung Dungan', 'wisata', 1.4558751, 109.0520094, 'https://maps.app.goo.gl/Taxk1pAztm9HvvV29', '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D907VK8A0471BKAPNC3', 'goa-alam-santok', 'Goa Alam Santok', 'wisata', 1.6148402, 109.4933338, 'https://maps.app.goo.gl/p5U9Be2CGvo3nPdE9', '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9070Z4GX6ZGZMR1YHV', 'riam-sunge-banokng', 'Riam Sunge Banokng', 'wisata', 1.6606583, 109.6043239, 'https://maps.app.goo.gl/V2R8gDPWssPyNw338', '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D909JY8T1Z78GW0STJH', 'bukit-piantus', 'Bukit Piantus', 'wisata', 1.4596049, 109.3149834, 'https://maps.app.goo.gl/MphfpVjrE5qSCU437', '', 'sejangkung', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90V5CDJAF8GM1P02KS', 'gunung-senujuh', 'Gunung Senujuh', 'wisata', 1.440249, 109.447872, 'https://maps.app.goo.gl/bfgNnvNx7hwCWZFk9', '', 'sejangkung', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D905M2V8D7KG5MKQT3P', 'makam-to-kullub', 'Makam To’ Kullub', 'wisata', 1.4588467, 109.3151266, NULL, '', 'sejangkung', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90125AX6ZHGXDMT207', 'rumah-batu', 'Rumah Batu', 'wisata', 1.154876, 109.4736136, 'https://maps.app.goo.gl/JT1rUgHzikGj5igq6', '', 'subah', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KXRDRTAGMPB62CRF', 'kebun-raya-sambas', 'Kebun Raya Sambas', 'wisata', 1.2699086, 109.4852044, 'https://maps.app.goo.gl/ziUmiSKvdjfvKWPP9', '', 'subah', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90YDSS634HV26YT5YJ', 'perkebunan-salak', 'Perkebunan Salak', 'wisata', 1.4717995, 109.2230538, 'https://maps.app.goo.gl/ihNoAwk3rvMbKHBd6', '', 'teluk-keramat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90ZNZAFZTMTKAVAHFR', 'tanjung-monang', 'Tanjung Monang', 'wisata', 1.3226802, 109.1774838, 'https://maps.app.goo.gl/UeVRiJY2s57P65vi6', '', 'teluk-keramat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90DFE87MY9590A2G8K', 'makam-keramat-sungai-kumpai', 'Makam Keramat Sungai Kumpai', 'wisata', 1.44545, 109.1998972, 'https://maps.app.goo.gl/wprjD9YVCHV4xJeK8', '', 'teluk-keramat', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90W30SME2E8QXXCJEE', 'perkebunan-sawo', 'Perkebunan Sawo', 'wisata', 1.2703429, 109.1298238, 'https://maps.app.goo.gl/CyUMbjeA5T4xxYht9', '', 'tekarang', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D9003AQD1WJQFT5544J', 'rumah-petinggi-tekarang', 'Rumah Petinggi Tekarang', 'wisata', 1.2615132, 109.0956351, 'https://maps.app.goo.gl/uuMKXwr9UoYvguFo7', '', 'tekarang', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90KAZW2Q3JJKP6FSY5', 'makam-petinggi-tekarang', 'Makam Petinggi Tekarang', 'wisata', 1.2706976, 109.1212793, 'https://maps.app.goo.gl/tDUWeJXuWkq1MJGDA', '', 'tekarang', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90AFV7HKA3GTX2QEFH', 'agro-wisata-buah-naga', 'Agro Wisata Buah Naga', 'wisata', 1.3343324484087697, 109.03875252741437, NULL, '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D903BV5467483MHZNE8', 'air-terjun-gunung-selindung', 'Air terjun Gunung Selindung', 'wisata', 1.1032109, 109.005479, 'https://maps.app.goo.gl/LGkFhuM2s1HeyRcG8', '', 'salatiga', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90XQK9QFV56HFG7TSG', 'makam-bantilan', 'Makam Bantilan', 'wisata', 1.4111562, 109.4039902, 'https://maps.app.goo.gl/RaPkZvQBuTrkTCJ29', '', 'sajad', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90S6EMR50J9XB7H03A', 'danau-biru', 'Danau Biru', 'wisata', 1.0507987, 109.11807, 'https://maps.app.goo.gl/WM2z9uafQkGK55Jm9', '', 'selakau-timur', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90XD5HHG84MEFYGT44', 'batu-nenek', 'Batu Nenek', 'wisata', 2.01894718153, 109.6014829, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90HG4B5ACCF4AN24KS', 'hutan-magrove-dusun-maludin', 'Hutan Mangrove Dusun Maludin', 'wisata', NULL, NULL, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90209PY2DWBDY7KQAZ', 'resort-camar-bulan', 'Resort Camar Bulan', 'wisata', 1.9929625903499533, 109.59185981356971, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90X5B21BNKGRFF87BG', 'crab-village-temajuk', 'Crab Village Temajuk', 'wisata', 1.9876991022874162, 109.58617988010586, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90TTB3T70ZVHJXB4M8', 'susur-sungai-11', 'Susur Sungai', 'wisata', 1.3842406, 109.3590377, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90WXF3RM99QX7DW0GX', 'batulapak', 'Batulapak', 'wisata', 1.2716011714495097, 108.98767328375143, NULL, '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90DVS2SCCW50B8P7P3', 'pantai-sungai-belacan', 'Pantai Sungai Belacan', 'wisata', 1.9443576828520326, 109.37528214378317, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D904PHGHDDB3RTXN4R7', 'pasar-wisata-aruk', 'Pasar Wisata Aruk', 'wisata', 1.6047177141127575, 109.67606039657066, NULL, '', 'sajingan-besar', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90J2D7R20WNM4X6ASK', 'kelenteng-sam-bong-ja', 'Kelenteng Sam Bong Ja Sam San Ket Bong', 'budaya', 1.36398, 109.29731, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90QSNK5NPYKR1REARA', 'museum-tamadun-islam', 'Museum Tamadun Islam', 'budaya', 1.356705, 109.315327, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90SBKD9TTK9ME5EZYH', 'museum-khazanah-melayu-h-subhan-nur', 'Museum Khazanah Melayu H. Subhan Nur', 'budaya', 1.3689004564, 109.2962237, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90TXFHGBJK4NN6C0TK', 'dermaga-wisata-sambas', 'Dermaga Wisata Sambas', 'budaya', 1.38992349, 109.31831505, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D902QPRMNVR9HD3EQNR', 'galeri-rotan-sejangkung', 'Galeri Rotan Sejangkung', 'budaya', 1.4398009584262332, 109.31326825465254, NULL, '', 'sejangkung', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90FXN39Y87XKX45C9Q', 'rumah-terbalik', 'Rumah Terbalik', 'budaya', 1.9896, 109.59075, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90B1AXMCY63ZXB21QB', 'rumah-kediaman-h-sood', 'Rumah Kediaman H. Sood Datuk Kaya Lela Mahkota', 'budaya', 1.36677135, 109.30828, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90N1G0EKWM0EEJYX8J', 'pantai-jlo', 'Pantai JLO', 'wisata', 2.0323093557973, 109.6089442873117, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90QMKMZHE0Z7SV2XW1', 'pantai-katsuri-indah', 'Pantai Katsuri Indah', 'wisata', 1.4475503249415531, 109.03619231008457, NULL, '', 'jawai', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90D4F7MZH6XSR765FR', 'pantai-matang-danau', 'Pantai Matang Danau', 'wisata', 1.620613905958414, 109.19940032347503, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90CEEX6G84P88FG2GH', 'pantai-pjm', 'Pantai PJM', 'wisata', 2.0072855857522898, 109.58994148231798, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D909KM71TC2MA106Q97', 'pantai-tiara', 'Pantai Tiara', 'wisata', 2.0294838598437273, 109.60778857094216, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90163RH5RM5K86T218', 'perkebunan-lada', 'Perkebunan Lada', 'wisata', 1.90181898501, 109.4305050321, NULL, '', 'paloh', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90SX9H3GGNQSP1SSX2', 'ramin-bantang-sungai-rambah', 'Ramin Bantang Sungai Rambah', 'wisata', 1.32568, 109.2795, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90YE41ZRJBNT81YYZ7', 'agro-wisata-buah-nenas', 'Agro Wisata Buah Nenas', 'wisata', 1.364624485, 109.21269522866, NULL, '', 'sambas', 'published', unixepoch());
--> statement-breakpoint
INSERT OR IGNORE INTO `places` (`id`, `slug`, `name`, `category`, `lat`, `lng`, `maps_url`, `short_description`, `region_id`, `status`, `created_at`) VALUES ('01MCKH7D90JRYSJAP7PDM2JTRA', 'taman-lunggi', 'Taman Lunggi', 'wisata', 1.36454144, 109.3230984, NULL, '', 'sambas', 'published', unixepoch());
