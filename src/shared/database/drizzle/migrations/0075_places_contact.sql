-- Kontak di seed 0072 tersimpan sebagai teks "[object Object]"
-- karena field contact di places.json berbentuk {phone, email}.
-- Pulihkan nomor dan email. Baris yang memang kosong jadi NULL.
UPDATE `places` SET `contact` = '081257579828' || char(10) || 'pokdarwispaggongsebedang@gmail.com' WHERE `slug` = 'danau-sebedang';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085229186159' || char(10) || 'budiprasetiya@rocketmail.com' WHERE `slug` = 'pantai-camar-bulan';
--> statement-breakpoint
UPDATE `places` SET `contact` = '0812-1000-2190' WHERE `slug` = 'pantai-tanjung-kemuning';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085229186159' || char(10) || 'budiprasetiya@rocketmail.com' WHERE `slug` = 'pantai-telok-atong-bahari';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085229186159' || char(10) || 'budiprasetiya@rocketmail.com' WHERE `slug` = 'hutan-hujan-tropis-tanjung-dato-di-temajuk';
--> statement-breakpoint
UPDATE `places` SET `contact` = '0812-1000-2190' WHERE `slug` = 'twa-tanjung-belimbing';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082148241312' || char(10) || 'sisikpenyu@gmail.com' WHERE `slug` = 'taman-rekreasi-batu-bejamban';
--> statement-breakpoint
UPDATE `places` SET `contact` = '0812-1000-2190' WHERE `slug` = 'pantai-rindu-samudera';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082148241312' || char(10) || 'sisikpenyu@gmail.com' WHERE `slug` = 'pantai-tanjung-api';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082151453167' WHERE `slug` = 'pantai-puteri-serayi';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085754421328' WHERE `slug` = 'pantai-kalang-bau';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082151453167' WHERE `slug` = 'taman-wisata-bahari';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085229186159' || char(10) || 'budiprasetiya@rocketmail.com' WHERE `slug` = 'batu-nenek';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085229186159' || char(10) || 'budiprasetiya@rocketmail.com' WHERE `slug` = 'hutan-magrove-dusun-maludin';
--> statement-breakpoint
UPDATE `places` SET `contact` = '085389729113' WHERE `slug` = 'resort-camar-bulan';
--> statement-breakpoint
UPDATE `places` SET `contact` = '0812-1000-2190' WHERE `slug` = 'crab-village-temajuk';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082252401336' || char(10) || 'pahimapima16@gmail.com' WHERE `slug` = 'susur-sungai-11';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082156941400' WHERE `slug` = 'batulapak';
--> statement-breakpoint
UPDATE `places` SET `contact` = '082148241312' || char(10) || 'sisikpenyu@gmail.com' WHERE `slug` = 'pantai-sungai-belacan';
