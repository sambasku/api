-- Cleansing data places: kosongkan field deskriptif turunan impor lama (data-only).
-- Sisa: nama, category, koordinat, kecamatan (region_id), maps_url.
-- Desa (village_id) tetap kosong - diisi admin lewat console.
-- short_description NOT NULL, jadi diisi '' (bukan NULL).
UPDATE `places` SET
  `short_description` = '',
  `hours` = NULL,
  `contact` = NULL,
  `type` = NULL,
  `sources_json` = '[]',
  `related_json` = '[]';
--> statement-breakpoint
DELETE FROM `place_images`;
